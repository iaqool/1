import * as anchor from "@coral-xyz/anchor";
import { Program, web3 } from "@coral-xyz/anchor";
import { assert } from "chai";
import { Skinsol } from "../target/types/skinsol";
import idl from "../target/idl/skinsol.json";

describe("SkinSol RWA - Full Test Suite", () => {
  const isDevnet = !!process.env.USE_DEVNET;
  const provider = isDevnet ? anchor.AnchorProvider.env() : anchor.AnchorProvider.local();
  anchor.setProvider(provider);

  const overrideProgramId = process.env.PROGRAM_ID;
  const program = new Program(
    (overrideProgramId ? { ...(idl as any), address: overrideProgramId } : (idl as any)) as any,
    provider
  ) as Program<Skinsol>;

  let vaultPda: anchor.web3.PublicKey;
  let users: anchor.web3.Keypair[] = [];
  
  // Хелпер: безопасная инициализация (если аккаунт уже есть на devnet — пропускаем)
  const ensureVaultInitialized = async (authorityPubkey: anchor.web3.PublicKey) => {
    const info = await provider.connection.getAccountInfo(vaultPda);
    if (info) {
      return; // уже создан
    }
    await program.methods
      .initializeVault()
      .accounts({
        authority: authorityPubkey,
        vault: vaultPda,
        systemProgram: web3.SystemProgram.programId,
      } as any)
      .rpc();
  };

  before(async () => {
    // Пользователи: на localnet создаём и airdrop'им 3 аккаунта,
    // на devnet используем только провайдерский кошелёк (чтобы не зависеть от faucet)
    if (!isDevnet) {
      for (let i = 0; i < 3; i++) {
        const user = anchor.web3.Keypair.generate();
        users.push(user);
        const sig = await provider.connection.requestAirdrop(user.publicKey, 1e9);
        await provider.connection.confirmTransaction(sig, "confirmed");
      }
    } else {
      users = [ (provider.wallet as anchor.Wallet).payer ];
    }

    // PDA для Vault: ["vault", authority]
    const authority = provider.wallet as anchor.Wallet;
    [vaultPda] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), authority.publicKey.toBuffer()],
      program.programId
    );

    // Инициализация Vault (без падения при повторном запуске на devnet)
    await ensureVaultInitialized(authority.publicKey);
  });

  /*** DEPOSIT TESTS ***/
  it("Single user deposit", async () => {
    const beforeVault = await program.account.vault.fetch(vaultPda);
    const depositAmount = new anchor.BN(1000);
    await program.methods
      .deposit(depositAmount)
      .accounts({ user: users[0].publicKey, vault: vaultPda } as any)
      .signers([users[0]])
      .rpc();

    const vaultAccount = await program.account.vault.fetch(vaultPda);
    assert.equal(
      vaultAccount.totalDeposits.toNumber(),
      beforeVault.totalDeposits.toNumber() + depositAmount.toNumber()
    );
  });

  it("Multiple users deposit sequentially", async () => {
    if (isDevnet) {
      // На devnet пропускаем multi-user сценарий (краны лимитируют SOL).
      return;
    }
    const beforeVault = await program.account.vault.fetch(vaultPda);
    const deposits = [500, 300];
    let expectedTotal = beforeVault.totalDeposits.toNumber();

    for (let i = 1; i < users.length; i++) {
      await program.methods
        .deposit(new anchor.BN(deposits[i - 1]))
        .accounts({ user: users[i].publicKey, vault: vaultPda } as any)
        .signers([users[i]])
        .rpc();
      expectedTotal += deposits[i - 1];
      const vaultAccount = await program.account.vault.fetch(vaultPda);
      assert.equal(vaultAccount.totalDeposits.toNumber(), expectedTotal);
    }
  });

  /*** WITHDRAW TESTS ***/
  it("Partial withdrawal", async () => {
    const beforeVault = await program.account.vault.fetch(vaultPda);
    const withdrawAmount = new anchor.BN(400);
    await program.methods
      .withdraw(withdrawAmount)
      .accounts({ user: users[0].publicKey, vault: vaultPda } as any)
      .signers([users[0]])
      .rpc();

    const vaultAccount = await program.account.vault.fetch(vaultPda);
    assert.equal(
      vaultAccount.totalDeposits.toNumber(),
      beforeVault.totalDeposits.toNumber() - withdrawAmount.toNumber()
    );
  });

  it("Excess withdrawal fails", async () => {
    const beforeVault = await program.account.vault.fetch(vaultPda);
    const withdrawAmount = new anchor.BN(5000);
    try {
      await program.methods
        .withdraw(withdrawAmount)
        .accounts({ user: users[0].publicKey, vault: vaultPda } as any)
        .signers([users[0]])
        .rpc();
      assert.fail("Withdrawal should fail");
    } catch (err: any) {
      assert.include(err.toString(), "Недостаточно средств");
    }
    const afterVault = await program.account.vault.fetch(vaultPda);
    assert.equal(afterVault.totalDeposits.toNumber(), beforeVault.totalDeposits.toNumber());
  });

  /*** REWARDS / INTEREST TESTS ***/
  it("Accrue rewards multiple times", async () => {
    const beforeVault = await program.account.vault.fetch(vaultPda);
    const rewards = [100, 50];
    let expectedTotal = beforeVault.totalDeposits.toNumber();

    for (let reward of rewards) {
      await program.methods
        .accrueRewards(new anchor.BN(reward))
        .accounts({ vault: vaultPda } as any)
        .rpc();

      expectedTotal += reward;
      const vaultAccount = await program.account.vault.fetch(vaultPda);
      assert.equal(vaultAccount.totalDeposits.toNumber(), expectedTotal);
    }
  });

  /*** MULTI-USER SCENARIOS ***/
  it("Concurrent deposits and withdrawals", async () => {
    if (isDevnet) {
      return; // пропускаем на devnet
    }
    const userA = users[0];
    const userB = users[1];
    const beforeVault = await program.account.vault.fetch(vaultPda);

    await Promise.all([
      program.methods
        .deposit(new anchor.BN(200))
        .accounts({ user: userA.publicKey, vault: vaultPda } as any)
        .signers([userA])
        .rpc(),
      program.methods
        .withdraw(new anchor.BN(100))
        .accounts({ user: userB.publicKey, vault: vaultPda } as any)
        .signers([userB])
        .rpc(),
    ]);

    const vaultAccount = await program.account.vault.fetch(vaultPda);
    assert.equal(
      vaultAccount.totalDeposits.toNumber(),
      beforeVault.totalDeposits.toNumber() + 200 - 100
    );
  });

  /*** VALIDATION ***/
  it("Edge case: deposit zero fails", async () => {
    // На devnet исходное состояние может меняться от предыдущих прогонов, так что проверяем только отсутствие изменения
    const beforeVault = await program.account.vault.fetch(vaultPda);
    try {
      await program.methods
        .deposit(new anchor.BN(0))
        .accounts({ user: users[0].publicKey, vault: vaultPda } as any)
        .signers([users[0]])
        .rpc();
      assert.fail("Deposit zero should fail");
    } catch (err: any) {
      assert.include(err.toString(), "Некорректная сумма");
    }
    const afterVault = await program.account.vault.fetch(vaultPda);
    assert.equal(afterVault.totalDeposits.toNumber(), beforeVault.totalDeposits.toNumber());
  });
});
