CREATE TABLE `session_additional_directory` (
	`id` text PRIMARY KEY,
	`session_id` text NOT NULL,
	`path` text NOT NULL,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL,
	CONSTRAINT `fk_session_additional_directory_session_id_session_id_fk` FOREIGN KEY (`session_id`) REFERENCES `session`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `session_add_dir_session_idx` ON `session_additional_directory` (`session_id`);
--> statement-breakpoint
CREATE INDEX `session_add_dir_path_idx` ON `session_additional_directory` (`path`);
