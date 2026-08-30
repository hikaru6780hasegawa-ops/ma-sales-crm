CREATE TABLE `daily_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`reportDate` bigint NOT NULL,
	`visitCount` int DEFAULT 0,
	`callCount` int DEFAULT 0,
	`meetingCount` int DEFAULT 0,
	`todaySummary` text NOT NULL,
	`achievements` text,
	`challenges` text,
	`tomorrowPlan` text,
	`mood` enum('great','good','normal','tough','bad') DEFAULT 'normal',
	`adminComment` text,
	`adminCommentAt` bigint,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `daily_reports_id` PRIMARY KEY(`id`)
);
