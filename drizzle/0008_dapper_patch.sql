ALTER TABLE `customer_files` ADD `customerId` int;--> statement-breakpoint
ALTER TABLE `customer_files` ADD `chk_license` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_files` ADD `chk_insurance` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_files` ADD `chk_resident_card` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_files` ADD `chk_seal_cert` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_files` ADD `chk_withholding` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_files` ADD `chk_pre_review` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_files` ADD `chk_main_review` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_files` ADD `chk_sale_contract` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_files` ADD `chk_loan_contract` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_files` ADD `chk_important_matter` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_files` ADD `chk_consent` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_files` ADD `chk_deposit` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_files` ADD `chk_commission` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_files` ADD `chk_business_card` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_files` ADD `chk_nameplate` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_files` ADD `chk_rental_mgmt` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_files` ADD `chk_real_estate_file` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_files` ADD `chk_settlement` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_files` ADD `chk_last_updated` bigint;--> statement-breakpoint
ALTER TABLE `customer_files` ADD `chk_updated_by` varchar(255);