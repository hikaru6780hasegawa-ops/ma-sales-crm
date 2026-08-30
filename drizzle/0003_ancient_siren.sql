CREATE TABLE `dashboard_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`widgetOrder` text,
	`hiddenWidgets` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dashboard_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `dashboard_settings_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `notification_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`emailEnabled` int NOT NULL DEFAULT 1,
	`dealReminderDays` int NOT NULL DEFAULT 3,
	`actionReminderDays` int NOT NULL DEFAULT 1,
	`weeklyReportEnabled` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notification_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `notification_settings_userId_unique` UNIQUE(`userId`)
);
