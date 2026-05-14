import cron from 'node-cron';
import { checkExpiredPaymentWindows } from '../services/violationService.js';

/**
 * AUTOMATED VIOLATION DETECTION
 * Cron job to check for expired payment windows and trigger violations
 * Runs every hour to check if any payment windows have expired
 */

// Run every hour at minute 0
const schedule = '0 * * * *'; // At minute 0 of every hour

export const startPaymentWindowChecker = () => {
  console.log('🕐 Payment Window Checker cron job started');
  console.log(`Schedule: ${schedule} (every hour)`);

  cron.schedule(schedule, async () => {
    try {
      console.log('\n⏰ [CRON] Checking for expired payment windows...');
      const violations = await checkExpiredPaymentWindows();

      if (violations && violations.length > 0) {
        console.log(`⚠️  [CRON] Processed ${violations.length} expired payment windows`);
        violations.forEach(v => {
          console.log(`   - User ${v.user_id}: Strike ${v.strike_number}`);
        });
      } else {
        console.log('✅ [CRON] No expired payment windows found');
      }
    } catch (err) {
      console.error('❌ [CRON] Error checking payment windows:', err);
    }
  });

  // Optional: Run immediately on startup for testing
  checkExpiredPaymentWindows().then(violations => {
    console.log(`Initial check complete: ${violations?.length || 0} violations found`);
  });
};

export default startPaymentWindowChecker;
