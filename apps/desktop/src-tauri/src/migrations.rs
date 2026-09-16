use tauri_plugin_sql::{Migration, MigrationKind};

pub fn get() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create_initial_tables",
            sql: include_str!("../migrations/0001_initial.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "seed_default_categories",
            sql: include_str!("../migrations/0002_seed_categories.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "accounts",
            sql: include_str!("../migrations/0003_accounts.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "allow_transfer_type",
            sql: include_str!("../migrations/0004_allow_transfer_type.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "account_groups",
            sql: include_str!("../migrations/0005_account_groups.sql"),
            kind: MigrationKind::Up,
        },
    ]
}
