import Streak from "../models/streak.js";
import HabitLog from "../models/habit_log.js";
import dayjs from "dayjs";

/**
 * Update streaks for a user's habit after a log entry is created
 * @param {string} userId - The user ID
 * @param {string} habitId - The habit ID
 * @returns {Promise<Array>} Array of saved streaks
 */
export const updateStreaks = async (userId, habitId) => {
    try {
      console.log(`Updating streaks for user ${userId}, habit ${habitId}`);
      
      // Get all logs for this habit, sorted by date
      const logs = await HabitLog.find({ owner: userId, habit: habitId })
        .select("date -_id")
        .sort({ date: 1 })
        .lean();
  
      console.log(`Found ${logs.length} logs for habit ${habitId}`);
  
      if (!logs.length) {
        // No logs exist, remove any existing streaks
        await Streak.deleteMany({ owner: userId, habit: habitId });
        console.log('No logs found, removed existing streaks');
        return [];
      }
  
      const dates = logs.map(log => log.date);
      console.log('Log dates:', dates);
      
      // Calculate streaks
      const streaks = calculateStreaks(dates);
      console.log('Calculated streaks:', streaks);
      
      // Remove old streaks for this habit
      await Streak.deleteMany({ owner: userId, habit: habitId });
      console.log('Removed old streaks');
  
      // Save new streaks
      const savedStreaks = await Promise.all(
        streaks.map(({ start, end }) => {
          const streakData = {
            owner: userId,
            habit: habitId,
            start_date: start.format("YYYY-MM-DD"),
            end_date: end ? end.format("YYYY-MM-DD") : null
          };
          console.log('Creating streak:', streakData);
          return new Streak(streakData).save();
        })
      );
  
      console.log(`Saved ${savedStreaks.length} streaks`);
      console.log('Saved streaks details:', savedStreaks.map(s => ({
        id: s._id,
        start_date: s.start_date,
        end_date: s.end_date,
        isCurrent: s.end_date === null
      })));
  
      // Mark longest streak
      await markLongestStreak(savedStreaks);
  
      // Verify that we have an ongoing streak if there's a log for today
      const todayLog = await HabitLog.findOne({
        habit: habitId,
        owner: userId,
        date: dayjs().format('YYYY-MM-DD')
      });
      
      console.log('Verification - today log found:', !!todayLog);
      
      if (todayLog) {
        const ongoingStreak = savedStreaks.find(s => s.end_date === null);
        console.log('Verification - ongoing streak found:', !!ongoingStreak);
        if (!ongoingStreak) {
          console.warn('WARNING: Found log for today but no ongoing streak was created!');
          console.log('All saved streaks:', savedStreaks.map(s => ({
            id: s._id,
            start_date: s.start_date,
            end_date: s.end_date,
            isCurrent: s.end_date === null
          })));
        } else {
          console.log('✅ Ongoing streak created successfully for today\'s log');
          console.log('Ongoing streak details:', {
            id: ongoingStreak._id,
            start_date: ongoingStreak.start_date,
            end_date: ongoingStreak.end_date
          });
        }
      } else {
        // Check if we should have an ongoing streak even without today's log
        const lastLog = await HabitLog.findOne({
          habit: habitId,
          owner: userId
        }).sort({ date: -1 });
        
        console.log('Verification - last log found:', lastLog ? lastLog.date : 'none');
        
        if (lastLog) {
          const daysSinceLastLog = dayjs().diff(dayjs(lastLog.date), 'day');
          const ongoingStreak = savedStreaks.find(s => s.end_date === null);
          
          console.log('Verification - days since last log:', daysSinceLastLog);
          console.log('Verification - ongoing streak found:', !!ongoingStreak);
          
          if (daysSinceLastLog <= 2 && !ongoingStreak) {
            console.warn(`WARNING: Last log was ${daysSinceLastLog} days ago but no ongoing streak was created!`);
            console.log('All saved streaks:', savedStreaks.map(s => ({
              id: s._id,
              start_date: s.start_date,
              end_date: s.end_date,
              isCurrent: s.end_date === null
            })));
          } else if (ongoingStreak) {
            console.log(`✅ Ongoing streak maintained (last log was ${daysSinceLastLog} days ago)`);
            console.log('Ongoing streak details:', {
              id: ongoingStreak._id,
              start_date: ongoingStreak.start_date,
              end_date: ongoingStreak.end_date
            });
          }
        }
      }
  
      return savedStreaks;
    } catch (error) {
      console.error('Error updating streaks:', error);
      throw error;
    }
  };

/**
 * Update streaks after undoing a habit completion - more conservative approach
 * @param {string} userId - The user ID
 * @param {string} habitId - The habit ID
 * @returns {Promise<Array>} Array of saved streaks
 */
export const updateStreaksAfterUndo = async (userId, habitId) => {
    try {
      console.log(`🔄 UNDO: Updating streaks for user ${userId}, habit ${habitId}`);
      
      // Get all logs for this habit, sorted by date
      const logs = await HabitLog.find({ owner: userId, habit: habitId })
        .select("date -_id")
        .sort({ date: 1 })
        .lean();
  
      console.log(`UNDO: Found ${logs.length} logs for habit ${habitId}`);
      console.log('UNDO: Log dates:', logs.map(log => log.date));
  
      if (!logs.length) {
        // No logs exist, remove any existing streaks
        await Streak.deleteMany({ owner: userId, habit: habitId });
        console.log('UNDO: No logs found, removed existing streaks');
        return [];
      }
      
      // For undo, we use a special calculation that's more conservative
      const dates = logs.map(log => log.date);
      const streaks = calculateStreaksForUndo(dates);
      console.log('UNDO: Calculated streaks:', streaks.map(s => ({
        start: s.start.format('YYYY-MM-DD'),
        end: s.end ? s.end.format('YYYY-MM-DD') : null
      })));
      
      // Remove old streaks for this habit
      await Streak.deleteMany({ owner: userId, habit: habitId });
      console.log('UNDO: Removed old streaks');
  
      // Save new streaks
      const savedStreaks = await Promise.all(
        streaks.map(({ start, end }) => {
          const streakData = {
            owner: userId,
            habit: habitId,
            start_date: start.format("YYYY-MM-DD"),
            end_date: end ? end.format("YYYY-MM-DD") : null
          };
          console.log('UNDO: Creating streak:', streakData);
          return new Streak(streakData).save();
        })
      );
  
      console.log(`UNDO: Saved ${savedStreaks.length} streaks`);
      console.log('UNDO: Saved streaks details:', savedStreaks.map(s => ({
        id: s._id,
        start_date: s.start_date,
        end_date: s.end_date,
        isCurrent: s.end_date === null
      })));
  
      // Mark longest streak
      await markLongestStreak(savedStreaks);
  
      return savedStreaks;
    } catch (error) {
      console.error('UNDO: Error updating streaks:', error);
      throw error;
    }
  };

/**
 * Calculate streaks from a sorted array of dates
 * @param {Array<string>} dates - Array of date strings in YYYY-MM-DD format
 * @returns {Array<Object>} Array of streak objects with start and end dayjs objects
 */
const calculateStreaks = (dates) => {
    console.log('Calculating streaks for dates:', dates);
    const streaks = [];
    let start = null;

    // Handle edge case: no dates
    if (!dates || dates.length === 0) {
        console.log('No dates provided for streak calculation');
        return streaks;
    }

    // Handle edge case: single date
    if (dates.length === 1) {
        const singleDate = dayjs(dates[0]);
        const today = dayjs();
        console.log('Single date streak calculation:', {
            date: singleDate.format('YYYY-MM-DD'),
            today: today.format('YYYY-MM-DD'),
            isToday: singleDate.isSame(today, 'day'),
            isYesterday: singleDate.isSame(today.subtract(1, 'day'), 'day')
        });
        
        // If the single date is today or yesterday, create an ongoing streak
        if (singleDate.isSame(today, 'day') || singleDate.isSame(today.subtract(1, 'day'), 'day')) {
            console.log('Creating ongoing streak for single recent date');
            streaks.push({ start: singleDate, end: null });
        } else {
            console.log('Creating completed streak for single old date');
            streaks.push({ start: singleDate, end: singleDate });
        }
        return streaks;
    }

    for (let i = 0; i < dates.length; i++) {
        const curr = dayjs(dates[i]);
        const prev = i > 0 ? dayjs(dates[i - 1]) : null;

        if (!start) start = curr;

        if (prev && !curr.isSame(prev.add(1, "day"))) {
            // Break in streak - only mark as completed if there's a clear gap
            const gapDays = curr.diff(prev, "day");
            console.log('Streak break detected:', { 
                start: start.format('YYYY-MM-DD'), 
                end: prev.format('YYYY-MM-DD'),
                gapDays: gapDays
            });
            
            // Only mark as completed if there's more than a 1-day gap
            if (gapDays > 1) {
                streaks.push({ start, end: prev });
            } else {
                // Small gap (1 day) - continue the streak
                console.log('Small gap detected, continuing streak');
            }
            start = curr;
        }
    }

    // Add the final streak
    if (start) {
        const lastDate = dayjs(dates[dates.length - 1]);
        const today = dayjs();
        
        console.log('Final streak calculation:', {
            start: start.format('YYYY-MM-DD'),
            lastDate: lastDate.format('YYYY-MM-DD'),
            today: today.format('YYYY-MM-DD'),
            isLastDateToday: lastDate.isSame(today, 'day'),
            daysSinceLastLog: today.diff(lastDate, 'day')
        });

        // More conservative approach: only mark as completed if there's a clear break
        const daysSinceLastLog = today.diff(lastDate, 'day');
        
        // If the last log is from today or yesterday, keep it as ongoing
        if (lastDate.isSame(today, 'day') || daysSinceLastLog <= 1) {
            console.log('Creating ongoing streak (last log is today or yesterday)');
            streaks.push({ start, end: null });
        } else {
            // Only mark as completed if there's a clear break (3+ days)
            console.log('Creating completed streak (last log was 2+ days ago)');
            streaks.push({ start, end: lastDate });
        }
    }

    console.log('Final streaks calculated:', streaks.map(s => ({
        start: s.start.format('YYYY-MM-DD'),
        end: s.end ? s.end.format('YYYY-MM-DD') : null
    })));

    return streaks;
};

/**
 * Calculate streaks from a sorted array of dates - more conservative approach
 * This version preserves ongoing streaks when undoing a habit completion.
 * @param {Array<string>} dates - Array of date strings in YYYY-MM-DD format
 * @returns {Array<Object>} Array of streak objects with start and end dayjs objects
 */
const calculateStreaksConservative = (dates) => {
    console.log('Calculating streaks (conservative) for dates:', dates);
    const streaks = [];
    let start = null;

    // Handle edge case: no dates
    if (!dates || dates.length === 0) {
        console.log('No dates provided for streak calculation');
        return streaks;
    }

    // Handle edge case: single date
    if (dates.length === 1) {
        const singleDate = dayjs(dates[0]);
        const today = dayjs();
        console.log('Single date streak calculation (conservative):', {
            date: singleDate.format('YYYY-MM-DD'),
            today: today.format('YYYY-MM-DD'),
            isToday: singleDate.isSame(today, 'day'),
            isYesterday: singleDate.isSame(today.subtract(1, 'day'), 'day')
        });
        
        // If the single date is today or yesterday, create an ongoing streak
        if (singleDate.isSame(today, 'day') || singleDate.isSame(today.subtract(1, 'day'), 'day')) {
            console.log('Creating ongoing streak (conservative) for single recent date');
            streaks.push({ start: singleDate, end: null });
        } else {
            console.log('Creating completed streak (conservative) for single old date');
            streaks.push({ start: singleDate, end: singleDate });
        }
        return streaks;
    }

    for (let i = 0; i < dates.length; i++) {
        const curr = dayjs(dates[i]);
        const prev = i > 0 ? dayjs(dates[i - 1]) : null;

        if (!start) start = curr;

        if (prev && !curr.isSame(prev.add(1, "day"))) {
            // Break in streak - only mark as completed if there's a clear gap
            const gapDays = curr.diff(prev, "day");
            console.log('Streak break detected (conservative):', { 
                start: start.format('YYYY-MM-DD'), 
                end: prev.format('YYYY-MM-DD'),
                gapDays: gapDays
            });
            
            // Only mark as completed if there's more than a 1-day gap
            if (gapDays > 1) {
                streaks.push({ start, end: prev });
            } else {
                // Small gap (1 day) - continue the streak
                console.log('Small gap detected (conservative), continuing streak');
            }
            start = curr;
        }
    }

    // Add the final streak
    if (start) {
        const lastDate = dayjs(dates[dates.length - 1]);
        const today = dayjs();
        
        console.log('Final streak calculation (conservative):', {
            start: start.format('YYYY-MM-DD'),
            lastDate: lastDate.format('YYYY-MM-DD'),
            today: today.format('YYYY-MM-DD'),
            isLastDateToday: lastDate.isSame(today, 'day'),
            daysSinceLastLog: today.diff(lastDate, 'day')
        });

        // More conservative approach: only mark as completed if there's a clear break
        const daysSinceLastLog = today.diff(lastDate, 'day');
        
        // If the last log is from today or yesterday, keep it as ongoing
        if (lastDate.isSame(today, 'day') || daysSinceLastLog <= 1) {
            console.log('Creating ongoing streak (conservative, last log is today or yesterday)');
            streaks.push({ start, end: null });
        } else if (daysSinceLastLog === 2) {
            // If the last log was 2 days ago, check if we should keep it ongoing
            // This handles the case where someone might have missed a day but the streak should continue
            console.log('Last log was 2 days ago (conservative) - keeping streak ongoing for flexibility');
            streaks.push({ start, end: null });
        } else {
            // Only mark as completed if there's a clear break (3+ days)
            console.log('Creating completed streak (conservative, last log was 3+ days ago)');
            streaks.push({ start, end: lastDate });
        }
    }

    console.log('Final streaks calculated (conservative):', streaks.map(s => ({
        start: s.start.format('YYYY-MM-DD'),
        end: s.end ? s.end.format('YYYY-MM-DD') : null
    })));

    return streaks;
};

/**
 * Calculate streaks specifically for undo operations - extremely conservative
 * This function prioritizes preserving ongoing streaks over accuracy
 * @param {Array<string>} dates - Array of date strings in YYYY-MM-DD format
 * @returns {Array<Object>} Array of streak objects with start and end dayjs objects
 */
const calculateStreaksForUndo = (dates) => {
    console.log('UNDO: Calculating streaks for dates:', dates);
    const streaks = [];
    let start = null;

    // Handle edge case: no dates
    if (!dates || dates.length === 0) {
        console.log('UNDO: No dates provided');
        return streaks;
    }

    // Handle edge case: single date - always create ongoing streak
    if (dates.length === 1) {
        const singleDate = dayjs(dates[0]);
        console.log('UNDO: Single date - creating ongoing streak');
        streaks.push({ start: singleDate, end: null });
        return streaks;
    }

    for (let i = 0; i < dates.length; i++) {
        const curr = dayjs(dates[i]);
        const prev = i > 0 ? dayjs(dates[i - 1]) : null;

        if (!start) start = curr;

        if (prev && !curr.isSame(prev.add(1, "day"))) {
            // Break in streak - be very conservative about ending streaks
            const gapDays = curr.diff(prev, "day");
            console.log('UNDO: Streak break detected:', { 
                start: start.format('YYYY-MM-DD'), 
                end: prev.format('YYYY-MM-DD'),
                gapDays: gapDays
            });
            
            // Only end streak if there's a very large gap (5+ days)
            if (gapDays > 4) {
                streaks.push({ start, end: prev });
                console.log('UNDO: Ended streak due to large gap');
            } else {
                // Small gap - continue the streak
                console.log('UNDO: Continuing streak despite gap');
            }
            start = curr;
        }
    }

    // Add the final streak - always make it ongoing for undo
    if (start) {
        console.log('UNDO: Creating final ongoing streak');
        streaks.push({ start, end: null });
    }

    console.log('UNDO: Final streaks calculated:', streaks.map(s => ({
        start: s.start.format('YYYY-MM-DD'),
        end: s.end ? s.end.format('YYYY-MM-DD') : null
    })));

    return streaks;
};

/**
 * Mark the longest streak among saved streaks
 * @param {Array<Object>} streaks - Array of saved streak objects
 */
const markLongestStreak = async (streaks) => {
    if (!streaks.length) return;

    let maxLength = 0;
    let longestStreak = null;

    streaks.forEach(streak => {
        const start = dayjs(streak.start_date);
        const end = streak.end_date ? dayjs(streak.end_date) : dayjs();
        const len = end.diff(start, "day") + 1;

        if (len > maxLength) {
            maxLength = len;
            longestStreak = streak;
        }
    });

    if (longestStreak) {
        longestStreak.longest = true;
        await longestStreak.save();
    }
};

/**
 * Get current ongoing streak for a habit
 * @param {string} userId - The user ID
 * @param {string} habitId - The habit ID
 * @returns {Promise<Object|null>} Current streak or null
 */
export const getCurrentStreak = async (userId, habitId) => {
    try {
        console.log(`Getting current streak for user ${userId}, habit ${habitId}`);

        // First, let's see all streaks for this habit
        const allStreaks = await Streak.find({
            habit: habitId,
            owner: userId
        });
        console.log(`Found ${allStreaks.length} total streaks for habit ${habitId}:`, allStreaks.map(s => ({
            id: s._id,
            start_date: s.start_date,
            end_date: s.end_date,
            isCurrent: s.end_date === null
        })));

        let streak = await Streak.findOne({
            habit: habitId,
            owner: userId,
            end_date: null
        });

        console.log('Found current streak:', streak);
        
        // Check last log and whether we should auto-close ongoing streaks
        const todayLog = await HabitLog.findOne({
            habit: habitId,
            owner: userId,
            date: dayjs().format('YYYY-MM-DD')
        });
        
        console.log('Today log found:', !!todayLog);
        
        // FIX 1: Automatic recovery - if there's a log for today but no ongoing streak
        if (!streak && todayLog) {
            console.log('⚠️ Found log for today but no ongoing streak. Attempting to recover...');
            try {
                // Recalculate streaks to fix the inconsistency
                await updateStreaks(userId, habitId);
                console.log('✅ Streaks recalculated successfully');
                
                // Try to get the streak again
                const recoveredStreak = await Streak.findOne({
                    habit: habitId,
                    owner: userId,
                    end_date: null
                });
                
                if (recoveredStreak) {
                    console.log('✅ Successfully recovered missing ongoing streak');
                    return recoveredStreak;
                } else {
                    console.warn('⚠️ Still no ongoing streak after recalculation');
                }
            } catch (error) {
                console.error('❌ Error during streak recovery:', error);
            }
        }
        
        // FIX 2: If we have an ongoing streak but the user hasn't logged for 2+ days, auto-close it
        if (streak) {
            const lastLog = await HabitLog.findOne({ habit: habitId, owner: userId }).sort({ date: -1 });
            if (lastLog) {
                const daysSinceLastLog = dayjs().diff(dayjs(lastLog.date), 'day');
                if (daysSinceLastLog >= 2) {
                    await Streak.updateOne({ _id: streak._id }, { $set: { end_date: lastLog.date } });
                    streak = null;
                }
            }
        }

        // If no ongoing streak found, let's check if there are any completed streaks
        if (!streak && allStreaks.length > 0) {
            console.log('No ongoing streak found, but there are completed streaks. Checking if we should create an ongoing one...');
            
            if (todayLog) {
                console.log('Found log for today but no ongoing streak. This might indicate a bug in streak calculation.');
                console.log('Today log details:', {
                    id: todayLog._id,
                    date: todayLog.date,
                    habit: todayLog.habit
                });
            }
        }
        
        // Additional debugging: check if there are any logs at all
        const allLogs = await HabitLog.find({
            habit: habitId,
            owner: userId
        }).sort({ date: -1 });
        
        console.log(`Found ${allLogs.length} total logs for habit ${habitId}:`, allLogs.map(l => l.date));
        
        return streak;
    } catch (error) {
        console.error('Error getting current streak:', error);
        throw error;
    }
};

/**
 * Get all streaks for a habit
 * @param {string} userId - The user ID
 * @param {string} habitId - The habit ID
 * @returns {Promise<Array>} Array of streaks
 */
export const getAllStreaks = async (userId, habitId) => {
    try {
        const streaks = await Streak.find({
            habit: habitId,
            owner: userId
        }).sort({ start_date: -1 });

        return streaks;
    } catch (error) {
        console.error('Error getting all streaks:', error);
        throw error;
    }
};

/**
 * Get streak statistics for a habit
 * @param {string} userId - The user ID
 * @param {string} habitId - The habit ID
 * @returns {Promise<Object>} Streak statistics
 */
export const getStreakStats = async (userId, habitId) => {
    try {
        const streaks = await getAllStreaks(userId, habitId);

        if (!streaks.length) {
            return {
                totalStreaks: 0,
                longestStreak: 0,
                currentStreak: 0,
                averageStreak: 0
            };
        }

        const currentStreak = await getCurrentStreak(userId, habitId);
        const longestStreak = streaks.find(s => s.longest);

        const streakLengths = streaks.map(streak => {
            const start = dayjs(streak.start_date);
            const end = streak.end_date ? dayjs(streak.end_date) : dayjs();
            return end.diff(start, "day") + 1;
        });

        return {
            totalStreaks: streaks.length,
            longestStreak: longestStreak ? dayjs(longestStreak.end_date || dayjs()).diff(dayjs(longestStreak.start_date), "day") + 1 : 0,
            currentStreak: currentStreak ? dayjs().diff(dayjs(currentStreak.start_date), "day") + 1 : 0,
            averageStreak: Math.round(streakLengths.reduce((a, b) => a + b, 0) / streakLengths.length)
        };
    } catch (error) {
        console.error('Error getting streak stats:', error);
        throw error;
    }
};

/**
 * Validate and fix streak consistency issues
 * @param {string} userId - The user ID
 * @param {string} habitId - The habit ID
 * @returns {Promise<Object>} Validation results
 */
export const validateStreakConsistency = async (userId, habitId) => {
    try {
        console.log(`🔍 Validating streak consistency for user ${userId}, habit ${habitId}`);
        
        const issues = [];
        const fixes = [];
        
        // Get all logs for this habit
        const logs = await HabitLog.find({ owner: userId, habit: habitId })
            .select("date -_id")
            .sort({ date: 1 })
            .lean();
        
        // Get all streaks for this habit
        const streaks = await Streak.find({ owner: userId, habit: habitId });
        
        console.log(`Found ${logs.length} logs and ${streaks.length} streaks`);
        
        // Check 1: Verify that streaks match the actual log data
        if (logs.length > 0) {
            const calculatedStreaks = calculateStreaks(logs.map(log => log.date));
            const expectedStreakCount = calculatedStreaks.length;
            const actualStreakCount = streaks.length;
            
            if (expectedStreakCount !== actualStreakCount) {
                issues.push(`Streak count mismatch: expected ${expectedStreakCount}, found ${actualStreakCount}`);
                fixes.push('Recalculate streaks');
            }
            
            // Check for ongoing streak consistency
            const hasOngoingStreak = streaks.some(s => s.end_date === null);
            const shouldHaveOngoing = calculatedStreaks.some(s => s.end === null);
            
            if (hasOngoingStreak !== shouldHaveOngoing) {
                issues.push(`Ongoing streak inconsistency: should have ongoing streak: ${shouldHaveOngoing}, has ongoing streak: ${hasOngoingStreak}`);
                fixes.push('Recalculate streaks');
            }
        }
        
        // Check 2: Verify that there's only one ongoing streak per habit
        const ongoingStreaks = streaks.filter(s => s.end_date === null);
        if (ongoingStreaks.length > 1) {
            issues.push(`Multiple ongoing streaks found: ${ongoingStreaks.length}`);
            fixes.push('Remove duplicate ongoing streaks');
        }
        
        // Check 3: Verify that streak dates are valid
        for (const streak of streaks) {
            if (streak.end_date && dayjs(streak.start_date).isAfter(dayjs(streak.end_date))) {
                issues.push(`Invalid streak dates: start ${streak.start_date} is after end ${streak.end_date}`);
                fixes.push('Fix invalid streak dates');
            }
        }
        
        // Check 4: Verify that there are no orphaned streaks (streaks without corresponding logs)
        if (logs.length === 0 && streaks.length > 0) {
            issues.push('Orphaned streaks found: streaks exist but no logs');
            fixes.push('Remove orphaned streaks');
        }
        
        // Apply fixes if needed
        if (fixes.length > 0) {
            console.log('🔧 Applying fixes for streak consistency issues...');
            
            if (fixes.includes('Recalculate streaks')) {
                await updateStreaks(userId, habitId);
                console.log('✅ Streaks recalculated');
            }
            
            if (fixes.includes('Remove duplicate ongoing streaks')) {
                const ongoingStreaks = await Streak.find({
                    habit: habitId,
                    owner: userId,
                    end_date: null
                });
                
                if (ongoingStreaks.length > 1) {
                    // Keep the most recent one
                    const sortedStreaks = ongoingStreaks.sort((a, b) => 
                        dayjs(b.start_date).diff(dayjs(a.start_date))
                    );
                    
                    for (let i = 1; i < sortedStreaks.length; i++) {
                        await Streak.findByIdAndDelete(sortedStreaks[i]._id);
                    }
                    console.log('✅ Duplicate ongoing streaks removed');
                }
            }
            
            if (fixes.includes('Remove orphaned streaks')) {
                await Streak.deleteMany({ habit: habitId, owner: userId });
                console.log('✅ Orphaned streaks removed');
            }
            
            if (fixes.includes('Fix invalid streak dates')) {
                for (const streak of streaks) {
                    if (streak.end_date && dayjs(streak.start_date).isAfter(dayjs(streak.end_date))) {
                        await Streak.findByIdAndDelete(streak._id);
                        console.log(`✅ Removed invalid streak: ${streak._id}`);
                    }
                }
            }
        }
        
        const result = {
            issues: issues,
            fixes: fixes,
            logsCount: logs.length,
            streaksCount: streaks.length,
            hasIssues: issues.length > 0,
            fixed: fixes.length > 0
        };
        
        console.log('✅ Streak validation completed:', result);
        return result;
        
    } catch (error) {
        console.error('❌ Error validating streak consistency:', error);
        throw error;
    }
};