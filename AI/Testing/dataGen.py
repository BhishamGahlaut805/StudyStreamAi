import pandas as pd
import numpy as np

def generate_educational_data(num_rows=5000, seed=42):
    np.random.seed(seed)
    data = []

    # Initial states
    mastery = 0.4
    fatigue = 0.05
    difficulty = 0.3
    streak = 0.0

    for i in range(num_rows):

        # --- 1. Accuracy (probabilistic, not deterministic) ---
        base_prob = 1 / (1 + np.exp(-(mastery - difficulty) * 6))
        fatigue_penalty = fatigue * 0.3
        noise = np.random.normal(0, 0.05)

        success_prob = np.clip(base_prob - fatigue_penalty + noise, 0.05, 0.95)
        accuracy = 1.0 if np.random.rand() < success_prob else 0.0

        # --- 2. Response time (affected by fatigue + difficulty) ---
        norm_response_time = np.clip(
            np.random.normal(0.15 + difficulty * 0.3 + fatigue * 0.3, 0.08),
            0.01, 1.0
        )

        # occasional spike (realistic behavior)
        if np.random.rand() < 0.05:
            norm_response_time = min(1.0, norm_response_time + np.random.uniform(0.2, 0.5))

        # --- 3. Rolling variance (not always zero) ---
        rolling_var = np.clip(
            np.random.normal(0.05 + fatigue * 0.2, 0.05),
            0.0, 1.0
        )

        # --- 4. Answer change count (now meaningful) ---
        answer_change = np.clip(
            np.random.normal(0.1 + difficulty * 0.3, 0.1),
            0.0, 1.0
        )

        # --- 5. Stress (less deterministic) ---
        stress = np.clip(
            0.5 * (1 - accuracy) + 0.3 * difficulty + 0.2 * fatigue + np.random.normal(0, 0.05),
            0.0, 1.0
        )

        # --- 6. Confidence (inverse-ish of stress, but noisy) ---
        confidence = np.clip(
            0.6 * accuracy + 0.3 * mastery - 0.2 * stress + np.random.normal(0, 0.05),
            0.0, 1.0
        )

        # --- 7. Mastery update ---
        if accuracy == 1.0:
            mastery += np.random.uniform(0.01, 0.03)
            streak = min(1.0, streak + np.random.uniform(0.1, 0.2))
        else:
            mastery -= np.random.uniform(0.005, 0.02)
            streak = 0.0

        mastery = np.clip(mastery, 0.0, 1.0)

        # --- 8. Fatigue dynamics (not strictly increasing) ---
        fatigue += np.random.uniform(0.002, 0.01)

        # occasional recovery
        if np.random.rand() < 0.05:
            fatigue -= np.random.uniform(0.1, 0.3)

        fatigue = np.clip(fatigue, 0.0, 1.0)

        # --- 9. Focus loss (depends on fatigue + stress) ---
        focus_loss = np.clip(
            0.3 * fatigue + 0.3 * stress + np.random.normal(0, 0.05),
            0.0, 1.0
        )

        # --- 10. Preferred difficulty (not directly tied to label) ---
        pref_offset = np.clip(
            0.5 + (confidence - 0.5) * 0.3 + np.random.normal(0, 0.05),
            0.0, 1.0
        )

        # --- 11. Next difficulty (target, now probabilistic) ---
        if accuracy == 1.0 and streak > 0.5:
            change = np.random.choice([0.0, 0.05, 0.1], p=[0.2, 0.3, 0.5])
        elif accuracy == 0.0:
            change = -np.random.choice([0.05, 0.1], p=[0.6, 0.4])
        else:
            change = np.random.choice([-0.05, 0.0, 0.05], p=[0.2, 0.6, 0.2])

        next_diff = np.clip(difficulty + change, 0.1, 1.0)

        # --- Save row ---
        row = [
            round(accuracy, 2),
            round(norm_response_time, 2),
            round(rolling_var, 2),
            round(answer_change, 2),
            round(stress, 2),
            round(confidence, 2),
            round(mastery, 2),
            round(difficulty, 2),
            round(streak, 2),
            round(fatigue, 2),
            round(focus_loss, 2),
            round(pref_offset, 2),
            round(next_diff, 2)
        ]

        data.append(row)

        # update difficulty
        difficulty = next_diff

    columns = [
        "accuracy", "normalized_response_time", "rolling_time_variance",
        "answer_change_count", "stress_score", "confidence_index",
        "concept_mastery_score", "current_question_difficulty",
        "consecutive_correct_streak", "fatigue_indicator",
        "focus_loss_frequency", "preferred_difficulty_offset", "next_difficulty"
    ]

    return pd.DataFrame(data, columns=columns)


# Generate dataset
df = generate_educational_data(5000)
df.to_csv("training_data_5000.csv", index=False)

print("Dataset with 5000 entries generated as 'training_data_5000.csv'")
