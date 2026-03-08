#TO DO
"""
RETENTION MODEL API FLOW & ARCHITECTURE
"""

# ============================================================================
# API FLOW OVERVIEW
# ============================================================================

"""
1. Frontend initiates practice session → NODE JS server
2. NODE JS server sends questions (JSON format) → Frontend
3. Frontend captures user interactions via Socket.IO
4. Frontend sends parameters to Flask backend (3 LSTM models):
    - Micro LSTM: Topic-level retention prediction
    - Meso LSTM: Subject-level retention prediction
    - Macro LSTM: Overall learning path optimization
5. Flask backend trains models → sends predictions to NODE JS
6. NODE JS saves metrics to MongoDB → sends to Frontend (visualization)
7. Flask generates daily learning schedule → NODE JS → Frontend
8. Flask provides API endpoints for predictions, retention summary, forgetting curves
9. Flask predicts stress level, fatigue, optimal study schedule

System Architecture:
Frontend ↔ NODE JS Server ↔ Flask Backend ↔ MongoDB

TODO - Flask Backend Tasks:
- Validate files align with API flow requirements
- Rewrite API blueprints robustly
- Create App.py to register blueprints
- Store all data in: C:/Users/bhish/OneDrive/Desktop/StudyStreamAi/AI/Retention_Model/Retention_Student_data
- Enable Flask-to-NODE JS communication for predictions/schedules
"""

# ============================================================================
# 1. MICRO LSTM - Topic Level Retention Prediction
# ============================================================================

"""
PURPOSE: Predict topic-level retention & optimal question difficulty

FEATURES (15):
1. Answer Correctness: Binary (1=correct, 0=incorrect)
2. Normalized Response Time: response_time / avg_response_time
3. Rolling Accuracy (Topic): Sum(correct_last_N) / N
4. Consecutive Correct Streak: Count of continuous correct answers
5. Time Since Last Attempt: current_time - last_attempt_time
6. Answer Change Count: Number of option switches
7. Confidence Rating: Self-reported [1-5]
8. Concept Mastery Score: Weighted accuracy with decay (e^(-λt))
9. Question Difficulty: Predefined [1-5]
10. Fatigue Indicator: session_elapsed_time / expected_focus_duration
11. Focus Loss Frequency: Count(response_time > μ + 2σ)
12. Rolling Response Time Variance: Σ(response_time - μ)² / N
13. Hint Usage Flag: Binary (1=used, 0=not used)
14. Preferred Difficulty Offset: attempted_difficulty - optimal_difficulty
15. Attempt Count Per Topic: Total practice attempts

TARGET VARIABLES:
- Retention Probability: P(correct future attempt)
- Next Question Difficulty: Optimal difficulty level
- Probability of Correct Next Attempt: σ(Wx + b)
"""

# ============================================================================
# 2. MESO LSTM - Subject Level Retention Prediction
# ============================================================================

"""
PURPOSE: Predict subject mastery trajectory & topic revision scheduling

FEATURES (15):
1. Subject Accuracy Rate: correct / total_attempts
2. Topic Mastery Vector: [m_vocab, m_idioms, m_synonyms, ...]
3. Forgetting Rate: accuracy_prev_session - accuracy_current_session
4. Session Performance Trend: Slope of accuracy vs question_index
5. Average Response Time: Mean response time for subject
6. Response Time Improvement Rate: (RT_first - RT_last) / RT_first
7. Difficulty Success Rate: Accuracy grouped by difficulty level
8. Revision Interval: Mean time gap between topic revisits
9. Topic Switch Frequency: topic_changes / session_length
10. Incorrect Pattern Frequency: repeated_wrong_concepts / total
11. Learning Velocity: topics_mastered / study_time
12. Engagement Score: questions_attempted / session_duration
13. Fatigue Trend: Slope of response_time vs question_index
14. Hint Dependency Rate: hints_used / total_questions
15. Retention Decay Index: performance_start - performance_end

TARGET VARIABLES:
- Subject Retention Score: [0,1] long-term mastery
- Next Topic Revision Priority: Ranking score for topic selection
- Optimal Revision Interval: Days until next revision
"""

# ============================================================================
# 3. MACRO LSTM - Learning Path Optimization
# ============================================================================

"""
PURPOSE: Predict long-term retention across subjects & optimize study schedule

FEATURES (15):
1. Overall Accuracy Rate: total_correct / total_attempts
2. Cross Subject Mastery Vector: [mastery_english, mastery_GK]
3. Daily Study Duration: Sum of session_durations per day
4. Study Consistency Index: active_days / 7
5. Fatigue Pattern: Mean session fatigue
6. Forgetting Curve Slope: R(t) = e^(-t/s)
7. Performance Variability: Variance of session_accuracy
8. Session Start Time Pattern: Preferred study time window
9. Topic Completion Rate: topics_completed / total_topics
10. Learning Efficiency Score: accuracy / study_time
11. Break Frequency: breaks / session_duration
12. Cognitive Load Index: Mean difficulty level attempted
13. Motivation Index: session_returns / total_days
14. Stress Indicator: incorrect_streak × response_time_spike
15. Retention Stability Score: 1 - variance(accuracy_over_time)

TARGET VARIABLES:
- Optimal Daily Study Schedule
- Subject Priority Order- Optimal Daily Study Schedule
- Subject Priority Order
- Predicted Long-Term Retention Score
- Fatigue Risk Probability
- Predicted Long-Term Retention Score
- Fatigue Risk Probability
"""

# ============================================================================
# 4. RAW DATA FROM REACT FRONTEND (via Socket.IO)
# ============================================================================

"""
Frontend sends raw interaction events (NOT engineered features):

- user_id, session_id, question_id
- subject, topic, question_difficulty
- selected_answer, correct_answer_flag
- response_time, timestamp
- hint_used, answer_changes
- confidence_rating, session_start_time
- device_focus_loss_event

Socket.IO Implementation:
socket.emit("practice_event", {
     user_id, session_id, question_id, subject, topic,
     selected_answer, correct_answer_flag, response_time,
     hint_used, answer_changes, confidence_rating, timestamp
})

Node Server Flow:
1. Receives raw events
2. Stores in MongoDB
3. Sends feature set to Flask backend
4. Receives predictions → sends to Frontend in real-time
"""

#--===========================================================================
#TO DO ahead (07-03-2026):
'''
1.The flask backend server is slow as compared to NODE JS server, and in the frontendPage like the RetentionInterfacePage.jsx, we are having the communication with the flask backend server for getting the 3 LSTM models data per question, and the questions data from NODEJS server, so we need to make the sync between both NODEJS server and flask backend server, so that the data can be sent to the frontend in real time without any delay, because sometimes the Flask backend is delaying in sending the data causing the NODEJS backend to give the timeOut error and raising the error as Flask backend is not responding.
2.The frontend Page is strongly connected via socket-io nodejs backend, we must handle the connection from both NODEJS server, Flask server in depth so that the UI works without breaking.
3.The frontend UI must strongly designed for getting the analytics metrics during retentionInterfacePage.jsx, so we need to design the UI in such a way that it can show the analytics metrics in a user-understandable way and must organize our backend also in the same manner.
4.Design the Page RetentionanalyticsPage.jsx very deeply and user understandable best UI and design using TOOLTIPS, CHARTS, GRAPHS, TABLES, and other UI components to show the analytics data in a very clear and concise way.
5.Create the Page information.jsx to display how the system works,what data has been calculated in real time in a efficient way.

Error getting predictions: Flask retention service temporarily unavailable (getPredictions); retry in 23s
Error getting Flask predictions: Error: Flask retention service temporarily unavailable (getPredictions); retry in 23s
    at RetentionFlaskService.request (C:\Users\bhish\OneDrive\Desktop\StudyStreamAi\Backend\Services\retentionFlaskService.js:91:13)
    at RetentionFlaskService.getPredictions (C:\Users\bhish\OneDrive\Desktop\StudyStreamAi\Backend\Services\retentionFlaskService.js:249:35)
    at exports.getOverallMetrics (C:\Users\bhish\OneDrive\Desktop\StudyStreamAi\Backend\controllers\retentionMetricsController.js:24:54)
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)

'''


#------------------------------------------------------------------------------

#The API flow of practice mode and Exam mode LSTM Models for practicising as per the difficulty level is :
''''
1.The module is dedicated for a Practice mode,Exam mode style of learning where students can practice questions of varying difficulty levels and the system will predict the optimal difficulty level for the next question based on their performance and retention metrics.
2.The system will use construct the 12 Models out of 4 are Generated by the Flask Backend and rest are generated by the NODEJS backend server, and the data will be sent to the frontend in real time using socket-io for showing the analytics metrics in the RetentionInterfacePage.jsx.
3.The 4

'''