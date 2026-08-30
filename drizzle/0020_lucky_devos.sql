CREATE TABLE `slack_notification_queue` (
	`id` int AUTO_INCREMENT NOT NULL,
	`channelId` varchar(50) NOT NULL,
	`channelName` varchar(255),
	`message` text NOT NULL,
	`type` varchar(50) NOT NULL,
	`referenceId` int,
	`status` enum('pending','sent','failed') NOT NULL DEFAULT 'pending',
	`sentAt` timestamp,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `slack_notification_queue_id` PRIMARY KEY(`id`)
);
