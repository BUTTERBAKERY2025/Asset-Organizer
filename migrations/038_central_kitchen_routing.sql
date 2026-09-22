BEGIN;
CREATE TABLE IF NOT EXISTS central_kitchen_routing (
 branch_id varchar PRIMARY KEY REFERENCES branches(id),
 responsible_user_id varchar REFERENCES users(id),
 deputy_user_id varchar REFERENCES users(id),
 receiver_user_id varchar REFERENCES users(id),
 updated_by varchar REFERENCES users(id),
 updated_at timestamp NOT NULL DEFAULT now(),
 CONSTRAINT central_kitchen_routing_distinct CHECK (
   responsible_user_id IS DISTINCT FROM deputy_user_id OR responsible_user_id IS NULL
 ),
 CONSTRAINT central_kitchen_routing_receiver_distinct CHECK (
   (receiver_user_id IS NULL OR responsible_user_id IS NULL OR receiver_user_id <> responsible_user_id)
   AND (receiver_user_id IS NULL OR deputy_user_id IS NULL OR receiver_user_id <> deputy_user_id)
 )
);
COMMIT;