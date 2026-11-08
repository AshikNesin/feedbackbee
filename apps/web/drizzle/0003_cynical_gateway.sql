ALTER TABLE `feedback` ADD `status` text DEFAULT 'open' NOT NULL;--> statement-breakpoint
CREATE INDEX `feedback_project_status_created_idx` ON `feedback` (`project_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `feedback_issue_idx` ON `feedback` (`issue_number`);--> statement-breakpoint
ALTER TABLE `github_apps` ADD `webhook_secret` text;