CREATE TABLE `transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '',
	`amount` integer DEFAULT 0 NOT NULL,
	`type` text NOT NULL,
	`is_amount_undefined` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
