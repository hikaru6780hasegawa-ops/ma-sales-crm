ALTER TABLE `form_templates` ADD `ownerName` varchar(255);--> statement-breakpoint
ALTER TABLE `form_templates` ADD `isShared` int DEFAULT 0 NOT NULL;