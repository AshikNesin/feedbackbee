CREATE TABLE `feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`kind` text NOT NULL,
	`text` text NOT NULL,
	`reporter_email` text,
	`reporter_name` text,
	`reporter_id` text,
	`metadata` text,
	`url` text,
	`user_agent` text,
	`screen_w` integer,
	`screen_h` integer,
	`app_version` text,
	`os_name` text,
	`os_version` text,
	`device_model` text,
	`recording_key` text,
	`recording_seconds` real,
	`audio_key` text,
	`audio_seconds` real,
	`state` text DEFAULT 'pending' NOT NULL,
	`issue_number` integer,
	`issue_url` text,
	`issue_error` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `feedback_project_created_idx` ON `feedback` (`project_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `feedback_images` (
	`feedback_id` text NOT NULL,
	`position` integer NOT NULL,
	`key` text NOT NULL,
	PRIMARY KEY(`feedback_id`, `position`),
	FOREIGN KEY (`feedback_id`) REFERENCES `feedback`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`github_repo` text NOT NULL,
	`labels` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `projects_slug_unique` ON `projects` (`slug`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`window_start` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `kv` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer
);
--> statement-breakpoint
CREATE INDEX `kv_expires_at_idx` ON `kv` (`expires_at`);--> statement-breakpoint
CREATE TABLE `passkeys` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`credential_id` text NOT NULL,
	`public_key` blob NOT NULL,
	`counter` integer DEFAULT 0 NOT NULL,
	`device_type` text,
	`backed_up` integer DEFAULT false NOT NULL,
	`transports` text DEFAULT '[]' NOT NULL,
	`credential_name` text,
	`last_used_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `passkeys_credential_id_unique` ON `passkeys` (`credential_id`);--> statement-breakpoint
CREATE INDEX `passkeys_user_id_idx` ON `passkeys` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`password` text NOT NULL,
	`name` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);