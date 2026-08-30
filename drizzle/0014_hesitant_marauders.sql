CREATE TABLE `minutes_numbers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`number` int NOT NULL,
	`customerName` varchar(255) NOT NULL,
	`note` text,
	`slackMessageTs` varchar(50),
	`customerFileId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `minutes_numbers_id` PRIMARY KEY(`id`),
	CONSTRAINT `minutes_numbers_number_unique` UNIQUE(`number`)
);
