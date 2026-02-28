CREATE TABLE `groups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`emoji` text DEFAULT '📁',
	`color` text DEFAULT '#6366f1',
	`created_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `tasks` ADD `group_id` integer REFERENCES groups(id);