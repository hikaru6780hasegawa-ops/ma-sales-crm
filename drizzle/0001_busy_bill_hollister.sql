CREATE TABLE `activities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`ownerId` int NOT NULL,
	`type` enum('visit','call','email','meeting','other') NOT NULL DEFAULT 'visit',
	`subject` varchar(255) NOT NULL,
	`description` text,
	`activityDate` bigint NOT NULL,
	`nextAction` text,
	`nextActionDate` bigint,
	`progressStatus` enum('planned','completed','cancelled') NOT NULL DEFAULT 'planned',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `activities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int,
	`reportType` enum('weekly','monthly') NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`periodStart` bigint NOT NULL,
	`periodEnd` bigint NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`companyName` varchar(255) NOT NULL,
	`contactName` varchar(255),
	`contactEmail` varchar(320),
	`contactPhone` varchar(50),
	`address` text,
	`postalCode` varchar(20),
	`industry` varchar(100),
	`status` enum('active','inactive','prospect','lost') NOT NULL DEFAULT 'prospect',
	`notes` text,
	`latitude` decimal(10,7),
	`longitude` decimal(10,7),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`ownerId` int NOT NULL,
	`dealName` varchar(255) NOT NULL,
	`amount` bigint DEFAULT 0,
	`probability` int DEFAULT 0,
	`phase` enum('lead','proposal','negotiation','closing','won','lost') NOT NULL DEFAULT 'lead',
	`expectedCloseDate` bigint,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `deals_id` PRIMARY KEY(`id`)
);
