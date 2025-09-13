import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Skinsol } from "../target/types/skinsol";
import idl from "../target/idl/skinsol.json";
import { assert } from "chai";

describe("skinsol-integration", () => {
  const isDevnet = !!process.env.USE_DEVNET;
  const provider = isDevnet ? anchor.AnchorProvider.env() : anchor.AnchorProvider.local();
  anchor.setProvider(provider);
  const overrideProgramId = process.env.PROGRAM_ID;
  const program = new Program(
    (overrideProgramId ? { ...(idl as any), address: overrideProgramId } : (idl as any)) as any,
    provider
  ) as Program<Skinsol>;

  let user1: anchor.web3.Keypair;
  let user2: anchor.web3.Keypair;
  let vaultPda1: anchor.web3.PublicKey;
  let vaultPda2: anchor.web3.PublicKey;
  let bump1: number;
  let bump2: number;

  beforeEach(async () => {
    if (isDevnet) {
      // На devnet используем отдельный кошелёк и финансируем его от провайдера, чтобы изолировать состояние
      user1 = anchor.web3.Keypair.generate();
      const fundTx = new anchor.web3.Transaction().add(
        anchor.web3.SystemProgram.transfer({
          fromPubkey: (provider.wallet as anchor.Wallet).publicKey,
          toPubkey: user1.publicKey,
          lamports: 20_000_000, // 0.02 SOL
        })
      );
      await provider.sendAndConfirm(fundTx, []);
      // на devnet второй пользователь и airdrop не используются
    } else {
      user1 = anchor.web3.Keypair.generate();
      user2 = anchor.web3.Keypair.generate();
    }
    [vaultPda1, bump1] = anchor.web3.PublicKey.findProgramAddressSync([
      Buffer.from("vault"), user1.publicKey.toBuffer()
    ], program.programId);
    if (!isDevnet) {
      [vaultPda2, bump2] = anchor.web3.PublicKey.findProgramAddressSync([
        Buffer.from("vault"), user2.publicKey.toBuffer()
      ], program.programId);
      // Airdrop SOL for users (localnet)
      const s1 = await provider.connection.requestAirdrop(user1.publicKey, 1e9);
      const s2 = await provider.connection.requestAirdrop(user2.publicKey, 1e9);
      await provider.connection.confirmTransaction(s1, 'confirmed');
      await provider.connection.confirmTransaction(s2, 'confirmed');
    }
    // Инициализация Vault для user1 (пропускаем, если уже есть)
    const info = await provider.connection.getAccountInfo(vaultPda1);
    if (!info) {
      await program.methods
        .initializeVault()
        .accounts({
          authority: user1.publicKey,
          vault: vaultPda1,
          systemProgram: anchor.web3.SystemProgram.programId,
        } as any)
        .signers([user1])
        .rpc();
    }
  });

  it("Генерирует и использует PDA корректно", async () => {
    // Депозит через PDA
    const beforeVault = await program.account.vault.fetch(vaultPda1);
    await program.methods
      .deposit(new anchor.BN(1000))
      .accounts({
        user: user1.publicKey,
        vault: vaultPda1,
      } as any)
      .signers([user1])
      .rpc();
    const vault = await program.account.vault.fetch(vaultPda1);
    assert.equal(
      vault.totalDeposits.toNumber(),
      beforeVault.totalDeposits.toNumber() + 1000
    );
  });

  it("PDA уникален для разных пользователей", async () => {
    if (isDevnet) return; // пропускаем на devnet
    assert.notEqual(vaultPda1.toString(), vaultPda2.toString());
  });

  it("Позволяет депозит любого пользователя (MVP)", async () => {
    if (isDevnet) return; // пропускаем на devnet
    const beforeVault = await program.account.vault.fetch(vaultPda1);
    await program.methods
      .deposit(new anchor.BN(100))
      .accounts({
          user: user2.publicKey,
          vault: vaultPda1,
        } as any)
      .signers([user2])
      .rpc();
    const vault = await program.account.vault.fetch(vaultPda1);
    assert.equal(vault.totalDeposits.toNumber(), beforeVault.totalDeposits.toNumber() + 100);
  });

  it("Пример: начисление вознаграждений (без CPI)", async () => {
    const beforeVault = await program.account.vault.fetch(vaultPda1);
    await program.methods
      .accrueRewards(new anchor.BN(10))
      .accounts({ vault: vaultPda1 })
      .rpc();
    const after = await program.account.vault.fetch(vaultPda1);
    assert.equal(after.totalDeposits.toNumber(), beforeVault.totalDeposits.toNumber() + 10);
  });
});
