# Teacher Advanced Analytics Routes Documentation

Complete guide for 15 advanced analytics routes for teacher dashboard with student learning data visualization.

## Base URL

All routes use: `GET /api/teachers`

---

## Route 1: Student Performance Analytics

**Endpoint:** `GET /api/teachers/analytics/student-performance/:studentId`

**Purpose:** Get detailed performance metrics for a single student with graphs/chart data

**Authorization:** Teacher/Admin (must teach course with this student)

**Response:**

```json
{
  "success": true,
  "data": {
    "studentId": "string",
    "overallAccuracy": "number (0-100)",
    "totalQuestionsAttempted": "number",
    "correctAnswers": "number",
    "averageTimePerQuestion": "number (minutes)",
    "masteryLevelDistribution": {
      "beginner": "number",
      "intermediate": "number",
      "advanced": "number",
      "expert": "number"
    },
    "performanceTrends": [
      {
        "date": "ISO date",
        "accuracy": "number",
        "questionsAttempted": "number",
        "timeSpent": "number (minutes)",
        "difficulty": "number (0-1)"
      }
    ],
    "topicPerformance": [
      {
        "topic": "string",
        "subject": "string",
        "accuracy": "number",
        "questionsAttempted": "number",
        "masteryLevel": "beginner|intermediate|advanced|expert",
        "stabilityIndex": "number",
        "retentionScore": "number (0-1)",
        "averageDifficulty": "number",
        "timeSpent": "number (minutes)",
        "lastPracticed": "ISO date"
      }
    ],
    "graphData": {
      "accuracyTrend": [{ "date": "ISO date", "accuracy": "number" }],
      "difficultyProgression": [{ "date": "ISO date", "difficulty": "number" }],
      "timeSpentPerDay": [{ "date": "ISO date", "timeSpent": "number" }]
    }
  }
}
```

**Use Case:** Main analytics dashboard - show student's overall performance, accuracy trends, topic breakdown

---

## Route 2: Learning Velocity Analysis

**Endpoint:** `GET /api/teachers/analytics/learning-velocity/:studentId`

**Purpose:** Track learning progress and velocity improvements over time

**Authorization:** Teacher/Admin

**Response:**

```json
{
  "success": true,
  "data": {
    "weeklyChart": [
      {
        "week": "YYYY-MM-DD",
        "avgAccuracy": "number",
        "avgDifficulty": "number",
        "totalTimeSpent": "number (minutes)",
        "totalQuestions": "number"
      }
    ],
    "velocityChange": {
      "accuracyImprovement": "number (-100 to 100)",
      "difficultyProgression": "number",
      "engagementTrend": "increasing|decreasing"
    },
    "totalWeeksActive": "number",
    "latestMetrics": {
      "currentAccuracy": "number",
      "currentDifficulty": "number",
      "weeklyEngagement": "number"
    }
  }
}
```

**Use Case:** Show learning progress over weeks, improvement rate, engagement trends with line charts

---

## Route 3: Retention Analytics

**Endpoint:** `GET /api/teachers/analytics/retention/:studentId`

**Purpose:** Analyze retention scores and forgetting patterns

**Authorization:** Teacher/Admin

**Response:**

```json
{
  "success": true,
  "data": {
    "overallRetentionScore": "number (0-100)",
    "totalTopicsTracked": "number",
    "topicsNeedingReview": "number",
    "topicRetention": [
      {
        "topic": "string",
        "subject": "string",
        "retentionScore": "number (0-100)",
        "forgettingRate": "number (0-100)",
        "masteryLevel": "string",
        "stabilityIndex": "number",
        "nextReviewDate": "ISO date",
        "reviewInterval": "number (days)",
        "lastPracticed": "ISO date"
      }
    ],
    "dailyMetricsChart": [
      {
        "date": "ISO date",
        "accuracy": "number",
        "focusLevel": "number",
        "stressLevel": "number",
        "fatigueLevel": "number"
      }
    ],
    "retentionTrend": {
      "improving": "yes|no",
      "riskAreas": ["topic1", "topic2"]
    }
  }
}
```

**Use Case:** Show retention heatmaps, forgetting curves, which topics need review, spaced repetition schedule

---

## Route 4: Burnout Risk Assessment

**Endpoint:** `GET /api/teachers/analytics/burnout-risk/:studentId`

**Purpose:** Assess risk of student burnout based on performance patterns

**Authorization:** Teacher/Admin

**Query Parameters:**

- None

**Response:**

```json
{
  "success": true,
  "data": {
    "burnoutRiskScore": "number (0-100)",
    "riskLevel": "High|Medium|Low",
    "riskFactors": [
      "Declining accuracy trend",
      "High study hours exceeding healthy average",
      "Inconsistent performance patterns",
      "Rapid difficulty increase",
      "Recent low engagement"
    ],
    "recommendations": [
      "Reduce learning load temporarily",
      "Encourage breaks between study sessions",
      "Consider adjusting course difficulty",
      "Schedule one-on-one check-in with student"
    ],
    "metrics": {
      "averageTimePerDay": "number (hours)",
      "accuracyVariance": "number",
      "overworkedDaysCount": "number",
      "recentDaysTracked": "number"
    }
  }
}
```

**Use Case:** Alert system for at-risk students, burnout risk badge, intervention recommendations

---

## Route 5: Topic Mastery Breakdown

**Endpoint:** `GET /api/teachers/analytics/topic-mastery/:studentId`

**Purpose:** Detailed breakdown of mastery by topic and subject

**Authorization:** Teacher/Admin

**Response:**

```json
{
  "success": true,
  "data": {
    "totalTopicsLearned": "number",
    "masteryDistribution": {
      "beginner": "number",
      "intermediate": "number",
      "advanced": "number",
      "expert": "number"
    },
    "subjectWiseAnalysis": [
      {
        "subject": "string",
        "topicCount": "number",
        "averageAccuracy": "number",
        "averageRetention": "number",
        "masteryDistribution": {
          "beginner": "number",
          "intermediate": "number",
          "advanced": "number",
          "expert": "number"
        },
        "weakTopics": [{ "topic": "string", "accuracy": "number" }],
        "strongTopics": [{ "topic": "string", "accuracy": "number" }]
      }
    ],
    "overallMasteryChart": [
      {
        "topic": "string",
        "accuracy": "number",
        "mastery": "beginner|intermediate|advanced|expert",
        "retention": "number"
      }
    ]
  }
}
```

**Use Case:** Mastery breakdown pie/donut charts by subject, radar charts showing topic performance

---

## Route 6: Class-wide Comparative Analysis

**Endpoint:** `GET /api/teachers/analytics/class-comparative/:courseId`

**Purpose:** Compare performance of all students in a course

**Authorization:** Teacher/Admin (must teach this course)

**Response:**

```json
{
  "success": true,
  "data": {
    "courseTitle": "string",
    "totalStudents": "number",
    "classAverages": {
      "accuracy": "number",
      "timePerQuestion": "number"
    },
    "allStudentStats": [
      {
        "studentId": "string",
        "studentName": "string",
        "accuracy": "number",
        "totalQuestions": "number",
        "correctAnswers": "number",
        "averageTimePerQuestion": "number",
        "topicsLearned": "number",
        "masteriesAchieved": {
          "beginner": "number",
          "intermediate": "number",
          "advanced": "number",
          "expert": "number"
        }
      }
    ],
    "topPerformers": [
      {
        "studentId": "string",
        "studentName": "string",
        "accuracy": "number"
      }
    ],
    "mostEfficientLearners": [
      {
        "studentId": "string",
        "studentName": "string",
        "averageTimePerQuestion": "number"
      }
    ],
    "performanceDistribution": {
      "excellent": "number (>=85%)",
      "good": "number (70-85%)",
      "average": "number (50-70%)",
      "needsSupport": "number (<50%)"
    }
  }
}
```

**Use Case:** Class comparison bar charts, leaderboard, performance distribution histogram, benchmarking

---

## Route 7: Weekly/Monthly Performance Trends

**Endpoint:** `GET /api/teachers/analytics/performance-trends/:studentId`

**Purpose:** Track performance over time with weekly or monthly grouping

**Authorization:** Teacher/Admin

**Query Parameters:**

- `timeframe` (optional): "weekly" or "monthly" (default: "monthly")

**Example:** `/api/teachers/analytics/performance-trends/:studentId?timeframe=weekly`

**Response:**

```json
{
  "success": true,
  "data": {
    "timeframe": "weekly|monthly",
    "totalPeriods": "number",
    "chartData": [
      {
        "period": "YYYY-MM-DD",
        "avgAccuracy": "number",
        "avgDifficulty": "number",
        "totalTimeSpent": "number",
        "totalQuestions": "number",
        "sessionCount": "number"
      }
    ],
    "summary": {
      "averageAccuracyAllTime": "number",
      "bestPeriod": {
        "period": "string",
        "avgAccuracy": "number"
      },
      "worstPeriod": {
        "period": "string",
        "avgAccuracy": "number"
      },
      "totalTimeSpentAllTime": "number",
      "totalQuestionsAnswered": "number"
    }
  }
}
```

**Use Case:** Line charts with trends, area charts for time spent, identifying peak/low performance periods

---

## Route 8: Error Pattern Analysis

**Endpoint:** `GET /api/teachers/analytics/error-patterns/:studentId`

**Purpose:** Analyze types of errors (conceptual, careless, guess, overconfidence)

**Authorization:** Teacher/Admin

**Response:**

```json
{
  "success": true,
  "data": {
    "errorDistribution": {
      "conceptual": "number",
      "careless": "number",
      "guess": "number",
      "overconfidence": "number",
      "total": "number"
    },
    "errorPercentages": {
      "conceptual": "number (%)",
      "careless": "number (%)",
      "guess": "number (%)",
      "overconfidence": "number (%)"
    },
    "errorsByTopic": [
      {
        "topic": "string",
        "conceptualErrors": "number",
        "carelessErrors": "number",
        "guessErrors": "number",
        "overconfidenceErrors": "number",
        "totalErrors": "number"
      }
    ],
    "recommendations": {
      "high_conceptual": ["recommendation1", "recommendation2"],
      "high_careless": ["recommendation1", "recommendation2"],
      "high_guess": ["recommendation1", "recommendation2"],
      "high_overconfidence": ["recommendation1", "recommendation2"]
    },
    "primaryErrorType": "conceptual|careless|guess|overconfidence"
  }
}
```

**Use Case:** Pie/donut charts showing error distribution, column charts by topic, intervention recommendations

---

## Route 9: Time Spent Analysis

**Endpoint:** `GET /api/teachers/analytics/time-spent/:studentId`

**Purpose:** Analyze study patterns and engagement based on time spent

**Authorization:** Teacher/Admin

**Response:**

```json
{
  "success": true,
  "data": {
    "totalTimeSpent": "number (minutes)",
    "totalTimeSpentHours": "number",
    "averageSessionDuration": "number (minutes)",
    "maxSessionTime": "number (minutes)",
    "minSessionTime": "number (minutes)",
    "totalSessions": "number",
    "studyDayDistribution": [
      {
        "day": "Mon|Tue|Wed|Thu|Fri|Sat|Sun",
        "averageTimeMinutes": "number",
        "sessionsCount": "number"
      }
    ],
    "topicTimeAnalysis": [
      {
        "topic": "string",
        "timeSpent": "number (minutes)",
        "accuracy": "number",
        "efficiency": "number (accuracy/time)"
      }
    ],
    "engagementSummary": {
      "category": "High Engagement|Medium Engagement|Low Engagement",
      "suggestion": "string"
    }
  }
}
```

**Use Case:** Heatmaps showing study patterns by day, horizontal bar charts for topic time allocation, efficiency metrics

---

## Route 10: Weak Students Identification

**Endpoint:** `GET /api/teachers/analytics/weak-students/:courseId`

**Purpose:** Identify students needing intervention in a course

**Authorization:** Teacher/Admin

**Query Parameters:**

- `threshold` (optional): Performance threshold percentage (default: 60)

**Example:** `/api/teachers/analytics/weak-students/:courseId?threshold=70`

**Response:**

```json
{
  "success": true,
  "data": {
    "courseTitle": "string",
    "performanceThreshold": "number",
    "totalWeakStudents": "number",
    "totalStudents": "number",
    "percentageNeedingSupport": "number (%)",
    "weakStudents": [
      {
        "studentId": "string",
        "studentName": "string",
        "studentEmail": "string",
        "overallAccuracy": "number",
        "performanceGap": "number (threshold - actual)",
        "weakTopics": [
          {
            "topic": "string",
            "accuracy": "number",
            "questionsAttempted": "number"
          }
        ],
        "averageTimePerQuestion": "number",
        "totalQuestionsAttempted": "number"
      }
    ],
    "interventionStrategies": {
      "severe": ["strategy1", "strategy2"],
      "moderate": ["strategy1", "strategy2"]
    },
    "priorityList": [
      {
        "...": "same as weakStudents + priority field"
      }
    ]
  }
}
```

**Use Case:** Filterable list of struggling students, intervention priority ranking, recommended strategies

---

## Route 11: Advanced Students Identification

**Endpoint:** `GET /api/teachers/analytics/advanced-students/:courseId`

**Purpose:** Identify high-performing students for enrichment

**Authorization:** Teacher/Admin

**Query Parameters:**

- `threshold` (optional): Excellence threshold percentage (default: 85)

**Example:** `/api/teachers/analytics/advanced-students/:courseId?threshold=80`

**Response:**

```json
{
  "success": true,
  "data": {
    "courseTitle": "string",
    "performanceThreshold": "number",
    "totalAdvancedStudents": "number",
    "totalStudents": "number",
    "percentageAdvanced": "number (%)",
    "advancedStudents": [
      {
        "studentId": "string",
        "studentName": "string",
        "studentEmail": "string",
        "overallAccuracy": "number",
        "expertTopics": ["topic1", "topic2"],
        "masteryCount": {
          "expert": "number",
          "advanced": "number"
        },
        "learningSpeed": "number (sessions)"
      }
    ],
    "enrichmentOpportunities": [
      "Advanced problem-solving challenges",
      "Peer mentoring roles",
      "Independent research projects",
      "Competition preparation",
      "Content creation tasks"
    ],
    "topPerformers": [
      {
        "...": "top 5 students"
      }
    ]
  }
}
```

**Use Case:** Identify gifted students, assign peer mentors, enrichment opportunities, advanced track recommendations

---

## Route 12: Intervention Alerts

**Endpoint:** `GET /api/teachers/analytics/intervention-alerts/:courseId`

**Purpose:** Get real-time alerts for students requiring intervention

**Authorization:** Teacher/Admin

**Response:**

```json
{
  "success": true,
  "data": {
    "courseTitle": "string",
    "totalAlerts": "number",
    "alertsBySeverity": {
      "critical": "number",
      "high": "number",
      "medium": "number",
      "low": "number"
    },
    "alerts": [
      {
        "type": "declining_performance|very_low_accuracy|low_engagement|high_forgetting_rate",
        "severity": "critical|high|medium|low",
        "studentId": "string",
        "studentName": "string",
        "message": "string",
        "actionRequired": "string"
      }
    ],
    "immediateActions": ["action1", "action2"]
  }
}
```

**Alert Types:**

- `declining_performance`: Performance dropped significantly
- `very_low_accuracy`: Below 40% accuracy
- `low_engagement`: Inactive for >7 days
- `high_forgetting_rate`: Multiple topics with low retention

**Use Case:** Alert dashboard, notification badges, prioritized intervention list

---

## Route 13: Individual Student Deep Profile

**Endpoint:** `GET /api/teachers/analytics/student-deep-profile/:studentId`

**Purpose:** Comprehensive individual student profile with all metrics

**Authorization:** Teacher/Admin

**Response:**

```json
{
  "success": true,
  "data": {
    "student": {
      "id": "string",
      "name": "string",
      "email": "string",
      "studentId": "string"
    },
    "performanceOverview": {
      "overallAccuracy": "number",
      "totalQuestionsAttempted": "number",
      "correctAnswers": "number",
      "topicsLearned": "number"
    },
    "learningPattern": {
      "totalSessions": "number",
      "averageSessionDuration": "number (minutes)",
      "lastActivityDate": "ISO date"
    },
    "masteryDistribution": {
      "beginner": "number",
      "intermediate": "number",
      "advanced": "number",
      "expert": "number"
    },
    "retentionProfile": {
      "averageRetentionScore": "number",
      "topicsNeedingReview": "number"
    },
    "strengths": [{ "topic": "string", "accuracy": "number" }],
    "areasForImprovement": [{ "topic": "string", "accuracy": "number" }]
  }
}
```

**Use Case:** Detailed student profile page with all comprehensive information, printable report

---

## Route 14: Class Performance Dashboard

**Endpoint:** `GET /api/teachers/analytics/class-dashboard/:courseId`

**Purpose:** Overall class performance metrics and statistics

**Authorization:** Teacher/Admin

**Response:**

```json
{
  "success": true,
  "data": {
    "courseTitle": "string",
    "totalStudents": "number",
    "classMetrics": {
      "averageAccuracy": "number",
      "highestAccuracy": "number",
      "lowestAccuracy": "number",
      "averageSessionTime": "number (minutes)",
      "averageTopicsPerStudent": "number"
    },
    "performanceDistribution": {
      "excellent": "number",
      "good": "number",
      "average": "number",
      "needsSupport": "number"
    },
    "engagementLevel": {
      "highlyEngaged": "number (>20 sessions)",
      "moderatelyEngaged": "number (5-20 sessions)",
      "lowEngagement": "number (<=5 sessions)"
    },
    "quickStats": {
      "studentsAboveAverage": "number",
      "studentsNeedingHelp": "number",
      "topPerformerCount": "number"
    }
  }
}
```

**Use Case:** Class dashboard overview, summary cards, quick statistics, at-a-glance overview

---

## Route 15: Predictive Recommendations

**Endpoint:** `GET /api/teachers/analytics/recommendations/:studentId`

**Purpose:** AI-driven personalized learning recommendations

**Authorization:** Teacher/Admin

**Response:**

```json
{
  "success": true,
  "data": {
    "studentId": "string",
    "totalRecommendations": "number",
    "recommendations": [
      {
        "id": "number",
        "category": "Study Strategy|Topic Focus|Retention|Pacing|Advancement",
        "priority": "high|medium|low",
        "title": "string",
        "description": "string",
        "action": "string",
        "estimatedTimeRequired": "string (hours or duration)"
      }
    ]
  }
}
```

**Recommendation Categories:**

- **Study Strategy**: Overall learning approach
- **Topic Focus**: Specific topics to focus on
- **Retention**: Review and spaced repetition
- **Pacing**: Speed adjustments
- **Advancement**: Moving to advanced topics

**Use Case:** Personalized recommendations panel, action items for student, intervention suggestions

---

## Frontend Implementation Examples

### Example 1: Performance Analytics Dashboard

```javascript
// Fetch student performance analytics
const response = await fetch(
  `/api/teachers/analytics/student-performance/${studentId}`,
  { headers: { Authorization: `Bearer ${token}` } },
);
const data = await response.json();

// Create line chart for accuracy trend
chart.line({
  labels: data.data.graphData.accuracyTrend.map((d) => d.date),
  datasets: [
    {
      label: "Accuracy Trend",
      data: data.data.graphData.accuracyTrend.map((d) => d.accuracy),
    },
  ],
});

// Pie chart for mastery distribution
chart.pie({
  labels: ["Beginner", "Intermediate", "Advanced", "Expert"],
  data: [
    data.data.masteryLevelDistribution.beginner,
    data.data.masteryLevelDistribution.intermediate,
    data.data.masteryLevelDistribution.advanced,
    data.data.masteryLevelDistribution.expert,
  ],
});
```

### Example 2: Class Comparative Analysis

```javascript
// Fetch class comparison
const response = await fetch(
  `/api/teachers/analytics/class-comparative/${courseId}`,
  { headers: { Authorization: `Bearer ${token}` } },
);
const data = await response.json();

// Create bar chart comparing students
chart.bar({
  labels: data.data.allStudentStats.map((s) => s.studentName),
  datasets: [
    {
      label: "Accuracy %",
      data: data.data.allStudentStats.map((s) => s.accuracy),
    },
  ],
});
```

### Example 3: Intervention Alerts

```javascript
// Fetch alerts
const response = await fetch(
  `/api/teachers/analytics/intervention-alerts/${courseId}`,
  { headers: { Authorization: `Bearer ${token}` } },
);
const data = await response.json();

// Display alerts sorted by severity
const criticalAlerts = data.data.alerts.filter(
  (a) => a.severity === "critical",
);
const highAlerts = data.data.alerts.filter((a) => a.severity === "high");

// Show notification badges
showBadge("Critical", criticalAlerts.length, "red");
showBadge("High", highAlerts.length, "orange");
```

---

## Error Handling

All endpoints return standardized error responses:

```json
{
  "success": false,
  "message": "Error message",
  "error": "Error details"
}
```

**Common HTTP Status Codes:**

- `200`: Success
- `400`: Invalid parameters
- `403`: Not authorized (teacher doesn't teach this course)
- `404`: Resource not found (student/course doesn't exist)
- `500`: Server error

---

## Rate Limiting & Performance Tips

1. Cache responses for 5-10 minutes where appropriate
2. Use pagination for large class datasets
3. Request only needed timeframes to reduce data volume
4. Combine multiple analytics in single page load where possible

---

## Required Models

These routes require the following models to be populated:

- `StudentPerformance`: Performance metrics, trends, topics
- `RetentionMetrics`: Retention scores, daily metrics
- `Course`: Course data with students and instructor
- `User`: Student information

---

## Summary Table

| #   | Route                | Purpose                  | Data Output                    | Chart Types    |
| --- | -------------------- | ------------------------ | ------------------------------ | -------------- |
| 1   | student-performance  | Overall performance      | Accuracy, topics, trends       | Line, Pie, Bar |
| 2   | learning-velocity    | Progress rate            | Weekly data, improvement       | Line, Area     |
| 3   | retention            | Forgetting patterns      | Retention scores, review dates | Heatmap, Line  |
| 4   | burnout-risk         | Risk assessment          | Risk score, factors            | Gauge, Alert   |
| 5   | topic-mastery        | Topic breakdown          | Mastery by subject             | Radar, Donut   |
| 6   | class-comparative    | Class comparison         | All students ranked            | Bar, Scatter   |
| 7   | performance-trends   | Time series              | Weekly/monthly data            | Line, Area     |
| 8   | error-patterns       | Error types              | Error distribution             | Pie, Column    |
| 9   | time-spent           | Study patterns           | Time by day/topic              | Heatmap, Bar   |
| 10  | weak-students        | At-risk list             | Students below threshold       | List, Bar      |
| 11  | advanced-students    | High performers          | Students above threshold       | List, Badge    |
| 12  | intervention-alerts  | Real-time alerts         | Alert list with severity       | Table, Badge   |
| 13  | student-deep-profile | Comprehensive profile    | All student data               | Summary        |
| 14  | class-dashboard      | Class overview           | Class statistics               | Cards, Stats   |
| 15  | recommendations      | Personalized suggestions | Action items                   | List, Cards    |
