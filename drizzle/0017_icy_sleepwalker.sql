ALTER TABLE `funding_plans` MODIFY COLUMN `fileUrl` text;--> statement-breakpoint
ALTER TABLE `funding_plans` MODIFY COLUMN `fileName` varchar(500);--> statement-breakpoint
ALTER TABLE `purchase_offers` MODIFY COLUMN `fileUrl` text;--> statement-breakpoint
ALTER TABLE `purchase_offers` MODIFY COLUMN `fileName` varchar(500);