CREATE TABLE `form_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`type` enum('purchaseOffer','fundingPlan') NOT NULL,
	`formData` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `form_templates_id` PRIMARY KEY(`id`)
);
