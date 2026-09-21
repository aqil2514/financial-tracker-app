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
        Migration {
            version: 6,
            description: "category_parent",
            sql: include_str!("../migrations/0006_category_parent.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "transfer_account_index",
            sql: include_str!("../migrations/0007_transfer_account_index.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 8,
            description: "active_flag",
            sql: include_str!("../migrations/0008_active_flag.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 9,
            description: "enforce_fk_set_null",
            sql: include_str!("../migrations/0009_enforce_fk_set_null.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 10,
            description: "transaction_attachments",
            sql: include_str!("../migrations/0010_transaction_attachments.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 11,
            description: "transaction_description",
            sql: include_str!("../migrations/0011_transaction_description.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 12,
            description: "debts",
            sql: include_str!("../migrations/0012_debts.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 13,
            description: "account_type",
            sql: include_str!("../migrations/0013_account_type.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 14,
            description: "transaction_contact",
            sql: include_str!("../migrations/0014_transaction_contact.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 15,
            description: "account_color",
            sql: include_str!("../migrations/0015_account_color.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 16,
            description: "retailku_account_mapping",
            sql: include_str!("../migrations/0016_retailku_account_mapping.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 17,
            description: "transaction_source",
            sql: include_str!("../migrations/0017_transaction_source.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 18,
            description: "retailku_ar_ap_snapshot",
            sql: include_str!("../migrations/0018_retailku_ar_ap_snapshot.sql"),
            kind: MigrationKind::Up,
        },
    ]
}
