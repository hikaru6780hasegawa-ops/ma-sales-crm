CREATE TABLE `api_keys` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`keyHash` varchar(255) NOT NULL,
	`keyPrefix` varchar(20) NOT NULL,
	`lastUsedAt` bigint,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `api_keys_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customer_tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`tagId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `customer_tags_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`color` varchar(20) NOT NULL DEFAULT '#4F46E5',
	`category` enum('industry','size','priority','status','custom') NOT NULL DEFAULT 'custom',
	`isShared` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tags_id` PRIMARY KEY(`id`)
);
