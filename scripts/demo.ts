import * as anchor from '@coral-xyz/anchor';
import BN from 'bn.js';
import { Program } from '@coral-xyz/anchor';
import { Skinsol } from '../target/types/skinsol.js';
import { Connection } from '@solana/web3.js';
import idl from '../target/idl/skinsol.json';

async function main() {
  // Провайдер берём из окружения (ANCHOR_PROVIDER_URL, ANCHOR_WALLET)
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // Выводим текущий кошелёк и баланс
  const connection = new Connection(provider.connection.rpcEndpoint, 'confirmed');
  const walletPubkey = (provider.wallet as anchor.Wallet).publicKey;
  const balance = await connection.getBalance(walletPubkey);
  console.log('Wallet:', walletPubkey.toBase58(), 'Balance:', balance / 1e9, 'SOL');

  // Program: поддержка PROGRAM_ID override (приоритетнее IDL.address)
  const overrideProgramId = process.env.PROGRAM_ID;
  const program = new Program(
    (overrideProgramId ? { ...(idl as any), address: overrideProgramId } : (idl as any)) as any,
    provider
  ) as Program<Skinsol>;

  // PDA для текущего кошелька провайдера
  const [vaultPda] = anchor.web3.PublicKey.findProgramAddressSync([
    Buffer.from('vault'), walletPubkey.toBuffer()
  ], program.programId);

  // Инициализация PDA (если ещё не создан)
  const info = await provider.connection.getAccountInfo(vaultPda);
  if (!info) {
    const txInit = await program.methods
      .initializeVault()
      .accounts({
        authority: walletPubkey,
        vault: vaultPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      } as any)
      .rpc();
    console.log('Vault PDA создан:', vaultPda.toBase58());
    console.log('Tx инициализации:', txInit);
  } else {
    console.log('Vault PDA уже существует:', vaultPda.toBase58());
  }

  // Депозит 500
  const txDeposit = await program.methods
    .deposit(new BN(500))
    .accounts({ user: walletPubkey, vault: vaultPda } as any)
    .rpc();
  console.log('Депозит 500 выполнен, tx:', txDeposit);

  // Проверка состояния
  const vault = await program.account.vault.fetch(vaultPda);
  console.log('Состояние Vault:', {
    owner: vault.owner.toBase58(),
    totalDeposits: vault.totalDeposits.toString(),
    loanAmount: vault.loanAmount.toString(),
    skinId: vault.skinId.toString(),
  });
}

main()
  .then(() => console.log('Demo finished'))
  .catch(err => console.error(err));
