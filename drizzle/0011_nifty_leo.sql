ALTER TABLE `customer_files` ADD `customerId` int;--> statement-breakpoint
ALTER TABLE `customer_files` ADD `docLicense` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_files` ADD `docInsurance` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_files` ADD `docGensen1` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_files` ADD `docGensen2` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_files` ADD `docGensen3` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_files` ADD `docCic` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_files` ADD `docPublicDoc` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_files` ADD `docPreReview` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_files` ADD `docCompliance` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_files` ADD `docHearing` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_files` ADD `docExistingLoan` int DEFAULT 0 NOT NULL;