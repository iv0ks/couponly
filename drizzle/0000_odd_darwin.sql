CREATE TABLE "coupons" (
	"id" integer PRIMARY KEY NOT NULL,
	"owner_id" integer NOT NULL,
	"title" text NOT NULL,
	"code" text NOT NULL,
	"discount_pct" integer NOT NULL,
	"redeemed" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" integer PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;