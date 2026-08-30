CREATE TABLE `slack_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`channelId` varchar(50) NOT NULL,
	`channelName` varchar(255) NOT NULL,
	`messageTs` varchar(50) NOT NULL,
	`userId` varchar(50),
	`userName` varchar(255),
	`messageText` text,
	`threadTs` varchar(50),
	`threadReplyCount` int DEFAULT 0,
	`reactions` text,
	`files` text,
	`postedAt` bigint NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `slack_messages_id` PRIMARY KEY(`id`)
);
