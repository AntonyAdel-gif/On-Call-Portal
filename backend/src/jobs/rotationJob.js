// src/jobs/rotationJob.js
import cron from 'node-cron';
import { extendRotation, cleanExcessFutureSchedule, cleanPastSchedule } from '../models/scheduleModel.js';
import { getAllTeamIds } from '../models/teamsModel.js';

// Automatically extends coverage buffer for all active teams to guarantee continuous schedule coverage without gaps.
async function runRotationExtension() {
  console.log('Checking rotation extension and cleaning 1-year past schedules for all teams...');
  // Purge past records older than 1 year to adhere to data retention guidelines.
  await cleanPastSchedule(1);
  const teamIds = await getAllTeamIds();
  for (const teamId of teamIds) {
    // Top off rotation schedules extending up to 60 days into the future.
    await extendRotation(teamId);
  }
}

// Clean up excess schedule data on startup & check if extension is needed (< 60 days remaining)
async function initializeRotationJob() {
  try {
    // Ensures database is immediately normalized on server restart before handling requests.
    await cleanPastSchedule(1);
    await cleanExcessFutureSchedule(60);
    await runRotationExtension();
  } catch (err) {
    console.error('Failed to initialize rotation job:', err);
  }
}

initializeRotationJob();

// Scheduled on the 1st of every month at midnight to append new rotation cycles well ahead of expiration.
cron.schedule('0 0 1 * *', runRotationExtension);