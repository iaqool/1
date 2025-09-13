use anchor_lang::prelude::*;

declare_id!("Gk85ZcvrXHUsYB255MCKHpwcUc8gPp6vSYbHjtUGKxpD");

#[program]
pub mod skinsol {

    /// Начисление доходности на пул
    pub fn accrue_rewards(ctx: Context<AccrueRewards>, amount: u64) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        vault.total_deposits = vault.total_deposits.checked_add(amount).ok_or(ErrorCode::Overflow)?;
        Ok(())
    }
#[derive(Accounts)]
pub struct AccrueRewards<'info> {
    #[account(mut)]
    pub vault: Account<'info, Vault>,
}

    /// Снятие средств из пула
    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        require!(vault.total_deposits >= amount, ErrorCode::InsufficientFunds);
        vault.total_deposits = vault.total_deposits.checked_sub(amount).ok_or(ErrorCode::Overflow)?;
        Ok(())
    }
#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub vault: Account<'info, Vault>,
}

    /// Депозит средств в пул
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        let vault = &mut ctx.accounts.vault;
        vault.total_deposits = vault.total_deposits.checked_add(amount).ok_or(ErrorCode::Overflow)?;
        Ok(())
    }
#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub vault: Account<'info, Vault>,
}
    use super::*;

    /// Инициализация аккаунта Vault
    pub fn initialize_vault(ctx: Context<InitializeVault>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        vault.owner = ctx.accounts.authority.key();
        vault.skin_id = 0;
        vault.loan_amount = 0;
        vault.total_deposits = 0;
        Ok(())
    }
#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + Vault::SIZE,
        seeds = [b"vault", authority.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, Vault>,
    pub system_program: Program<'info, System>,
}

    /// Депозитируем NFT как залог
    pub fn deposit_skin_as_collateral(
        ctx: Context<DepositSkinAsCollateral>,
        skin_id: u64,
    ) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        vault.owner = ctx.accounts.user.key();
        vault.skin_id = skin_id;
        vault.loan_amount = 0;
        Ok(())
    }

    /// Берём займ под залог
    pub fn borrow(ctx: Context<Borrow>, amount: u64) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        require_keys_eq!(vault.owner, ctx.accounts.user.key(), ErrorCode::Unauthorized);

        // для MVP: просто записываем сумму займа (без реального SOL-трансфера)
        vault.loan_amount += amount;

        Ok(())
    }

    /// Возвращаем займ и освобождаем NFT
    pub fn repay(ctx: Context<Repay>, amount: u64) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        require_keys_eq!(vault.owner, ctx.accounts.user.key(), ErrorCode::Unauthorized);

        require!(vault.loan_amount >= amount, ErrorCode::InvalidRepayAmount);
        vault.loan_amount -= amount;

        // если долг погашен – можно очистить skin_id
        if vault.loan_amount == 0 {
            vault.skin_id = 0;
        }

        Ok(())
    }

    /// Ручная ликвидация (MVP): обнулить долг и освободить NFT
    pub fn liquidate(ctx: Context<Liquidate>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        // В MVP позволяем владельцу ликвидировать свой же залог вручную
        require_keys_eq!(vault.owner, ctx.accounts.authority.key(), ErrorCode::Unauthorized);
        vault.loan_amount = 0;
        vault.skin_id = 0;
        Ok(())
    }

    /// Выставить NFT на аренду (по mint), указываем суточную цену в USD (MVP)
    pub fn list_for_rent(
        ctx: Context<ListForRent>,
        daily_price_usd: u64,
    ) -> Result<()> {
        let listing = &mut ctx.accounts.listing;
        listing.owner = ctx.accounts.owner.key();
        listing.mint = ctx.accounts.mint.key();
        listing.daily_price_usd = daily_price_usd;
        listing.is_listed = true;
        listing.renter = Pubkey::default();
        listing.rented_until = 0;
        Ok(())
    }

    /// Арендовать NFT на N дней (без реального перевода токенов, только запись в состояние)
    pub fn rent(ctx: Context<RentListing>, days: u64) -> Result<()> {
        let listing = &mut ctx.accounts.listing;
        require!(listing.is_listed, ErrorCode::NotListed);
        // Простейшая логика: устанавливаем арендатора и срок аренды
        let clock = Clock::get()?;
        let add_secs = days
            .checked_mul(86_400)
            .ok_or(ErrorCode::Overflow)? as i64;
        listing.renter = ctx.accounts.renter.key();
        listing.rented_until = clock.unix_timestamp.checked_add(add_secs).ok_or(ErrorCode::Overflow)?;
        listing.is_listed = false;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct DepositSkinAsCollateral<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        init,
        payer = user,
        space = 8 + Vault::SIZE,
        seeds = [b"vault", user.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, Vault>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Borrow<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [b"vault", user.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, Vault>,
}

#[derive(Accounts)]
pub struct Repay<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [b"vault", user.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, Vault>,
}

#[derive(Accounts)]
pub struct Liquidate<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [b"vault", authority.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, Vault>,
}

#[derive(Accounts)]
pub struct ListForRent<'info> {
    /// Владелец, кто листит NFT
    #[account(mut)]
    pub owner: Signer<'info>,
    /// Mint NFT (для MVP — просто Pubkey, без проверки токен-аккаунтов)
    /// CHECK: mint key only
    pub mint: UncheckedAccount<'info>,
    #[account(
        init,
        payer = owner,
        space = 8 + Listing::SIZE,
        seeds = [b"listing", mint.key().as_ref()],
        bump
    )]
    pub listing: Account<'info, Listing>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RentListing<'info> {
    /// Арендатор
    #[account(mut)]
    pub renter: Signer<'info>,
    /// Mint NFT
    /// CHECK: mint key only
    pub mint: UncheckedAccount<'info>,
    #[account(
        mut,
        seeds = [b"listing", mint.key().as_ref()],
        bump
    )]
    pub listing: Account<'info, Listing>,
}

#[account]
pub struct Vault {
    pub owner: Pubkey,
    pub skin_id: u64,
    pub loan_amount: u64,
    pub total_deposits: u64,
}

impl Vault {
    pub const SIZE: usize = 32 + 8 + 8 + 8; // Pubkey + u64 + u64 + u64
}

#[account]
pub struct Listing {
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub daily_price_usd: u64,
    pub is_listed: bool,
    pub renter: Pubkey,
    pub rented_until: i64, // unix timestamp
}

impl Listing {
    pub const SIZE: usize = 32 + 32 + 8 + 1 + 32 + 8;
}

#[error_code]
pub enum ErrorCode {
    #[msg("Вы не владелец этого залога")]
    Unauthorized,
    #[msg("Некорректная сумма для возврата")]
    InvalidRepayAmount,
    #[msg("Недостаточно средств")]
    InsufficientFunds,
    #[msg("Некорректная сумма")]
    InvalidAmount,
    #[msg("Переполнение")]
    Overflow,
    #[msg("Объявление не активно для аренды")]
    NotListed,
}

// Простейшая прайс‑карта для скинов по skin_id
pub fn price_for_skin(skin_id: u64) -> u64 {
    match skin_id {
        1 => 1000, // Karambit
        2 => 500,  // AWP Dragon Lore
        3 => 100,  // Glock Fade
        _ => 0,
    }
}
