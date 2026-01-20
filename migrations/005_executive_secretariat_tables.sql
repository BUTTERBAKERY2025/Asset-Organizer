-- ==========================================
-- Executive Secretariat Module - السكرتارية التنفيذية
-- Migration: 005_executive_secretariat_tables.sql
-- ==========================================

-- 1. Executive Meetings - الاجتماعات التنفيذية
CREATE TABLE IF NOT EXISTS exec_meetings (
  id SERIAL PRIMARY KEY,
  branch_id VARCHAR REFERENCES branches(id),
  title TEXT NOT NULL,
  title_en TEXT,
  agenda TEXT,
  agenda_en TEXT,
  meeting_type TEXT DEFAULT 'regular',
  start_at TIMESTAMP NOT NULL,
  end_at TIMESTAMP,
  location TEXT,
  location_en TEXT,
  is_virtual BOOLEAN DEFAULT false,
  virtual_meeting_link TEXT,
  organizer_id VARCHAR REFERENCES users(id),
  organizer_name TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  minutes TEXT,
  decisions TEXT,
  reminder_sent BOOLEAN DEFAULT false,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_exec_meetings_branch ON exec_meetings(branch_id);
CREATE INDEX IF NOT EXISTS idx_exec_meetings_organizer ON exec_meetings(organizer_id);
CREATE INDEX IF NOT EXISTS idx_exec_meetings_status ON exec_meetings(status);
CREATE INDEX IF NOT EXISTS idx_exec_meetings_start ON exec_meetings(start_at);

-- 2. Meeting Attendees - حضور الاجتماعات
CREATE TABLE IF NOT EXISTS exec_meeting_attendees (
  id SERIAL PRIMARY KEY,
  meeting_id INTEGER NOT NULL REFERENCES exec_meetings(id) ON DELETE CASCADE,
  user_id VARCHAR REFERENCES users(id),
  attendee_name TEXT NOT NULL,
  attendee_email TEXT,
  attendee_phone TEXT,
  role TEXT DEFAULT 'attendee',
  is_external BOOLEAN DEFAULT false,
  external_organization TEXT,
  attendance_status TEXT DEFAULT 'invited',
  attended_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_exec_attendees_meeting ON exec_meeting_attendees(meeting_id);
CREATE INDEX IF NOT EXISTS idx_exec_attendees_user ON exec_meeting_attendees(user_id);

-- 3. Executive Tasks - المهام التنفيذية
CREATE TABLE IF NOT EXISTS exec_tasks (
  id SERIAL PRIMARY KEY,
  branch_id VARCHAR REFERENCES branches(id),
  title TEXT NOT NULL,
  title_en TEXT,
  description TEXT,
  description_en TEXT,
  task_type TEXT DEFAULT 'general',
  assigned_to VARCHAR REFERENCES users(id),
  assigned_to_name TEXT,
  created_by VARCHAR REFERENCES users(id),
  created_by_name TEXT,
  related_type TEXT,
  related_id INTEGER,
  due_date TIMESTAMP,
  start_date TIMESTAMP,
  completed_at TIMESTAMP,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'pending',
  progress INTEGER DEFAULT 0,
  notes TEXT,
  reminder_sent BOOLEAN DEFAULT false,
  reminder_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_exec_tasks_branch ON exec_tasks(branch_id);
CREATE INDEX IF NOT EXISTS idx_exec_tasks_assigned ON exec_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_exec_tasks_created_by ON exec_tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_exec_tasks_status ON exec_tasks(status);
CREATE INDEX IF NOT EXISTS idx_exec_tasks_priority ON exec_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_exec_tasks_due_date ON exec_tasks(due_date);

-- 4. Executive Correspondence - المراسلات التنفيذية
CREATE TABLE IF NOT EXISTS exec_correspondence (
  id SERIAL PRIMARY KEY,
  branch_id VARCHAR REFERENCES branches(id),
  ref_number TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'incoming',
  subject TEXT NOT NULL,
  subject_en TEXT,
  body TEXT,
  body_en TEXT,
  sender_name TEXT,
  sender_organization TEXT,
  sender_email TEXT,
  sender_phone TEXT,
  receiver_name TEXT,
  receiver_organization TEXT,
  receiver_email TEXT,
  receiver_phone TEXT,
  category TEXT DEFAULT 'general',
  priority TEXT DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'received',
  received_at TIMESTAMP,
  sent_at TIMESTAMP,
  response_deadline TIMESTAMP,
  responded_at TIMESTAMP,
  response_ref_number TEXT,
  attachments JSONB DEFAULT '[]',
  owner_id VARCHAR REFERENCES users(id),
  owner_name TEXT,
  assigned_to VARCHAR REFERENCES users(id),
  assigned_to_name TEXT,
  is_confidential BOOLEAN DEFAULT false,
  notes TEXT,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_exec_corr_branch ON exec_correspondence(branch_id);
CREATE INDEX IF NOT EXISTS idx_exec_corr_type ON exec_correspondence(type);
CREATE INDEX IF NOT EXISTS idx_exec_corr_status ON exec_correspondence(status);
CREATE INDEX IF NOT EXISTS idx_exec_corr_category ON exec_correspondence(category);
CREATE INDEX IF NOT EXISTS idx_exec_corr_owner ON exec_correspondence(owner_id);
CREATE INDEX IF NOT EXISTS idx_exec_corr_assigned ON exec_correspondence(assigned_to);
CREATE INDEX IF NOT EXISTS idx_exec_corr_received ON exec_correspondence(received_at);
CREATE UNIQUE INDEX IF NOT EXISTS exec_correspondence_ref_unique ON exec_correspondence(ref_number);

-- 5. Task Comments - تعليقات المهام
CREATE TABLE IF NOT EXISTS exec_task_comments (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES exec_tasks(id) ON DELETE CASCADE,
  user_id VARCHAR REFERENCES users(id),
  user_name TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_exec_task_comments_task ON exec_task_comments(task_id);

-- 6. Executive Notifications - تنبيهات السكرتارية
CREATE TABLE IF NOT EXISTS exec_notifications (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR REFERENCES users(id),
  branch_id VARCHAR REFERENCES branches(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  title_en TEXT,
  body TEXT,
  body_en TEXT,
  entity_type TEXT,
  entity_id INTEGER,
  priority TEXT DEFAULT 'normal',
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP,
  scheduled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_exec_notif_user ON exec_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_exec_notif_branch ON exec_notifications(branch_id);
CREATE INDEX IF NOT EXISTS idx_exec_notif_read ON exec_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_exec_notif_entity ON exec_notifications(entity_type, entity_id);
