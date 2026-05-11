# Teacher Dashboard Analytics - Data Requirements Guide

## Overview

The teacher dashboard shows empty cards when the backend MongoDB collections lack sufficient data. This guide lists which collections MUST have ample data for the analytics to work properly.

---

## 📊 Critical MongoDB Schemas Required for Analytics

### 1. **StudentPerformance** (⭐ MOST IMPORTANT)

**File:** `Backend/models/studentPerformance.js`

**Why It's Critical:**

- The dashboard backend aggregates ALL analytics from this collection
- Every metric card depends on StudentPerformance records

**Required Fields to Populate:**

```javascript
{
  studentId: String,           // Unique student ID
  userId: ObjectId,            // Reference to User
  overallStats: {
    totalQuestions: Number,    // Questions attempted
    totalCorrect: Number,      // Correct answers
    accuracy: Number,          // % accuracy
    totalTimeSpent: Number,    // Minutes spent
    totalTests: Number,        // Tests completed
    averageDifficulty: Number, // 0.0 - 1.0
    currentStreak: Number,     // Study streak
    lastActive: Date
  },
  topicPerformance: [          // Per-topic performance
    {
      topic: String,
      accuracy: Number,
      questionsAttempted: Number,
      correctAnswers: Number,
      retentionScore: Number
    }
  ],
  testHistory: [               // Historical test data
    {
      date: Date,
      accuracy: Number,
      conceptsTested: [String],
      timeSpent: Number
    }
  ],
  analytics: {                 // Calculated analytics
    conceptMastery: {topic: value, ...},
    confidenceCalibration: {overall: Number, byDifficulty: {...}},
    errorPatterns: {conceptual: Number, careless: Number, ...},
    fatigueIndex: {current: Number, trend: String}
  }
}
```

**Where Data Comes From:**

- TestSession completions → StudentPerformance.overallStats
- RetentionMetrics updates
- Quiz/Practice Test submissions

**Empty Cards Caused By:**

- ❌ No StudentPerformance records created
- ❌ Missing testHistory entries
- ❌ analytics object not calculated

---

### 2. **TestSession** (⭐ VERY IMPORTANT)

**File:** `Backend/models/TestSession.js`

**Why It's Critical:**

- Each test/quiz completion should create a TestSession
- TestSessions feed data into StudentPerformance

**Required Fields:**

```javascript
{
  studentId: ObjectId,
  testType: String,           // 'practice' | 'real_exam'
  startTime: Date,
  endTime: Date,
  questions: [
    {
      questionId: ObjectId,
      conceptArea: String,
      difficulty: Number
    }
  ],
  answers: [
    {
      questionId: ObjectId,
      studentAnswer: Mixed,
      isCorrect: Boolean,
      confidence: Number      // 0-100
    }
  ],
  summary: {
    correctAnswers: Number,
    totalTimeSpent: Number,   // in seconds
    accuracy: Number
  },
  status: String              // 'completed' | 'ongoing'
}
```

**Empty Cards Caused By:**

- ❌ No TestSession records for completed tests
- ❌ Tests not marked as 'completed'
- ❌ No answers submitted in sessions

---

### 3. **Enrollment** (⭐ IMPORTANT)

**File:** `Backend/models/Courses/Enrollment.js`

**Why It's Critical:**

- Links students to courses
- Used to determine which students belong to a teacher's classes
- Filters StudentPerformance by enrolled students

**Required Fields:**

```javascript
{
  student: ObjectId,          // User ID
  course: ObjectId,
  enrollmentStatus: String,   // 'active' | 'completed'
  progress: {
    overallProgress: Number,  // 0-100
    completedLessons: Number,
    completedAssignments: Number
  },
  enrolledAt: Date,
  learningMetrics: {
    lastActivityAt: Date,
    totalTimeSpent: Number
  }
}
```

**Empty Cards Caused By:**

- ❌ No enrollments created for students
- ❌ Course has no enrolled students

---

### 4. **Course** (⭐ IMPORTANT)

**File:** `Backend/models/Courses/course.js`

**Why It's Critical:**

- Teacher dashboard shows metrics per course
- Used to determine which courses a teacher teaches

**Required Fields:**

```javascript
{
  title: String,
  instructor: ObjectId,       // Teacher User ID
  status: String,             // 'published' | 'draft'
  students: [                 // Subdocument array
    {
      user: ObjectId,         // Student User ID
      enrolledAt: Date,
      progress: Number
    }
  ],
  totalStudents: Number,
  rating: {
    average: Number
  }
}
```

**Empty Cards Caused By:**

- ❌ Courses have no students array populated
- ❌ Course not linked to teacher
- ❌ Course.students not updated when enrollments change

---

### 5. **RetentionMetrics** (OPTIONAL - Advanced)

**File:** `Backend/models/retentionMetrics.js`

**Why It's Used:**

- Provides retention-specific analytics
- Feeds into "Retention Highlights" card

**Required Fields for Retention Data:**

```javascript
{
  studentId: ObjectId,
  topicRetentionScores: [
    {
      topic: String,
      retentionScore: Number,  // 0-100
      lastReviewDate: Date,
      reviewCount: Number
    }
  ],
  forgettingCurve: [...],      // Spaced repetition tracking
  predictions: {
    predictedRetention: Number,
    riskLevel: String
  }
}
```

---

### 6. **User** & **Profile** (IMPORTANT)

**Files:**

- `Backend/models/user.js`
- `Backend/models/profile.js`

**Why It's Critical:**

- Used to hydrate student names and emails in dashboard
- Displays "Top Performers" and "Students Needing Support"

**Required Fields (User):**

```javascript
{
  _id: ObjectId,
  name: String,
  email: String,
  studentId: String
}
```

**Required Fields (Profile):**

```javascript
{
  userId: ObjectId,
  fullName: String,
  additionalEmail: String
}
```

---

## 🔴 Why Cards Show Empty/Zero Values

| Card                      | Reason                         | Solution                         |
| ------------------------- | ------------------------------ | -------------------------------- |
| **Students with Data**    | No StudentPerformance records  | Create test completions          |
| **Total Tests**           | No TestSession completed       | Submit quiz/test answers         |
| **Learning Trend**        | No accuracyTrend data          | Generate trend from testHistory  |
| **Subject Performance**   | No topicPerformance data       | Add conceptArea to questions     |
| **Concept Mastery**       | Empty conceptMastery analytics | Calculate from topic performance |
| **Retention Highlights**  | No retentionScore in topics    | Populate RetentionMetrics        |
| **Confidence**            | No confidence values           | Add confidence to answers        |
| **Fatigue Index**         | No fatigueIndex calculated     | Run fatigueIndex calculation     |
| **Top/Weak Topics**       | No topic accuracy tracking     | Categorize questions by topic    |
| **Top Performers**        | No student with high scores    | Complete tests with good results |
| **Areas Needing Support** | No weak topic data             | Complete tests with low accuracy |

---

## 🛠️ Data Population Strategy

### Step 1: Create Student Records

```javascript
// Create User + Profile for students
const user = new User({ name, email, studentId });
const profile = new Profile({ userId: user._id, fullName: name });
```

### Step 2: Enroll Students in Courses

```javascript
// Create Enrollments linking students to courses
const enrollment = new Enrollment({
  student: userId,
  course: courseId,
  enrollmentStatus: "active",
});

// Update Course.students array
course.students.push({ user: userId });
```

### Step 3: Create Test Sessions

```javascript
// When student takes a quiz/test
const testSession = new TestSession({
  studentId,
  testType: 'practice',
  questions: [...],
  answers: [
    { questionId, studentAnswer, isCorrect, confidence }
  ],
  status: 'completed'
});

// This should trigger:
testSession.calculateSummary();  // Sets correctAnswers, accuracy
```

### Step 4: Update StudentPerformance

```javascript
// After test completion
const studentPerf = await StudentPerformance.findOne({ studentId });
studentPerf.updateWithTestSession(testSession); // Updates all analytics
studentPerf.calculateConceptMastery(); // Calculates mastery
studentPerf.calculateFatigueIndex(); // Calculates fatigue
await studentPerf.save();
```

---

## 📈 Data Volume Recommendations

For meaningful analytics, populate:

- **Minimum:** 5 students with 10+ tests each
- **Recommended:** 20+ students with 20+ tests each
- **Optimal:** 50+ students with 50+ tests each

```
Total Tests = Students × Tests Per Student
            = 20 students × 20 tests = 400 tests

With 400 tests:
✅ Learning trends visible
✅ Student rankings accurate
✅ Topic patterns emerge
✅ Fatigue/confidence meaningful
```

---

## 🔍 Debugging Empty Cards

**To diagnose why a card is empty:**

1. Check StudentPerformance collection:

   ```bash
   db.studentperformances.count()
   # Should be > 0
   ```

2. Check if analytics are calculated:

   ```bash
   db.studentperformances.findOne({ studentId: "xxx" })
   # Look for: analytics.accuracyTrend, conceptMastery, etc.
   ```

3. Check TestSession records:

   ```bash
   db.testsessions.find({ status: "completed" }).count()
   # Should match number of completed tests
   ```

4. Verify student-course links:
   ```bash
   db.enrollments.find({ course: courseId }).count()
   # Should match expected students
   ```

---

## 🎯 Summary Table

| Schema             | Priority | Purpose                | Empty If                    |
| ------------------ | -------- | ---------------------- | --------------------------- |
| StudentPerformance | ⭐⭐⭐   | Analytics aggregation  | No records or records empty |
| TestSession        | ⭐⭐⭐   | Test data source       | No completed tests          |
| Enrollment         | ⭐⭐⭐   | Student-course mapping | No enrollments              |
| Course             | ⭐⭐     | Course metadata        | No students in courses      |
| RetentionMetrics   | ⭐⭐     | Retention analytics    | Not populated               |
| User/Profile       | ⭐⭐     | Student identity       | Missing name/email          |
| TopicPerformance   | ⭐⭐     | Topic tracking         | Questions lack conceptArea  |

---

## 💡 Quick Test Checklist

- [ ] Students exist in User collection
- [ ] Profiles created for students
- [ ] Students enrolled in courses
- [ ] Enrollments marked 'active'
- [ ] TestSessions completed
- [ ] TestSession.answers populated
- [ ] StudentPerformance records created
- [ ] StudentPerformance.testHistory filled
- [ ] StudentPerformance.analytics calculated
- [ ] Metrics show non-zero values in dashboard
