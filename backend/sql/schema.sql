
CREATE TYPE role_type AS ENUM ('user', 'admin', 'super_admin');
CREATE TYPE swap_status AS ENUM ('pending', 'accepted', 'rejected');

CREATE TABLE teams (
    team_id SERIAL PRIMARY KEY,
    team_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    cycle_day INTEGER,
    cycle_st_day DATE,
    manager_emp_id INTEGER
);

CREATE TABLE employee (
    emp_id SERIAL PRIMARY KEY,
    emp_name VARCHAR(50) NOT NULL,
    phone1 VARCHAR(50),
    phone2 VARCHAR(50),
    emp_mail VARCHAR(50),
    team_id INTEGER REFERENCES teams(team_id),
    ftid VARCHAR(50),
    def_oncall_ord INTEGER,
    active_flg BOOLEAN DEFAULT TRUE,
    role role_type NOT NULL DEFAULT 'user',
    bk_emp_id INTEGER REFERENCES employee(emp_id)
);

CREATE TABLE applications (
    application_id SERIAL PRIMARY KEY,
    application_name VARCHAR(100) NOT NULL,
    team_id INTEGER REFERENCES teams(team_id),
    app_class VARCHAR(50),
    supporting_hours VARCHAR(100),
    sla VARCHAR(100)
);

CREATE TABLE schedule (
    emp_id INTEGER REFERENCES employee(emp_id),
    start_dt TIMESTAMP,
    end_dt TIMESTAMP,
    bk_emp_id INTEGER REFERENCES employee(emp_id),
    cycle_id INTEGER,
    PRIMARY KEY (emp_id, start_dt)
);

CREATE TABLE static_info (
    info_id SERIAL PRIMARY KEY,
    team_name VARCHAR(100) NOT NULL,
    region VARCHAR(100) NOT NULL,
    working_hours VARCHAR(100) NOT NULL,
    url VARCHAR(255),
    created_by INTEGER REFERENCES employee(emp_id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE swap_requests (
    request_id SERIAL PRIMARY KEY,
    requester_emp_id INTEGER NOT NULL REFERENCES employee(emp_id),
    target_emp_id INTEGER NOT NULL REFERENCES employee(emp_id),
    requester_schedule_start TIMESTAMP NOT NULL,
    target_schedule_start TIMESTAMP NOT NULL,
    status swap_status NOT NULL DEFAULT 'pending',
    requested_at TIMESTAMP DEFAULT NOW(),
    responded_at TIMESTAMP
);

ALTER TABLE teams ADD CONSTRAINT fk_team_manager FOREIGN KEY (manager_emp_id) REFERENCES employee(emp_id);
ALTER TABLE teams ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE employee ADD CONSTRAINT chk_backup_not_self CHECK (bk_emp_id IS NULL OR bk_emp_id <> emp_id);
--this is for changing the (app class) & (supporting hours) with basicat & cartoo ID
ALTER TABLE applications DROP COLUMN app_class;
ALTER TABLE applications DROP COLUMN supporting_hours;
ALTER TABLE applications ADD COLUMN basicat VARCHAR(100);
ALTER TABLE applications ADD COLUMN cartoo_id VARCHAR(5);
ALTER TABLE applications ADD CONSTRAINT chk_cartoo_id_length CHECK (LENGTH(cartoo_id) = 5);
-- removing region & supporting hours in static info
ALTER TABLE static_info DROP COLUMN region;
ALTER TABLE static_info DROP COLUMN working_hours;
-- requiring ftid when adding an employee
ALTER TABLE employee ALTER COLUMN ftid SET NOT NULL;
--PostgreSQL only checks this constraint at the end of a transaction,
--not after each individual UPDATE — this is exactly what makes
--a clean two-row swap possible without a temporary placeholder value
ALTER TABLE employee ADD CONSTRAINT uq_team_rotation_order
  UNIQUE (team_id, def_oncall_ord) DEFERRABLE INITIALLY DEFERRED;
