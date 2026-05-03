import React from 'react'

const backendinfo = () => {
  return (
    <div className="mt-8 bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-indigo-100 dark:border-indigo-900">
    <motion.div
      variants={fadeInUp}
      initial="initial"
      animate="animate"
      className="mt-8 bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-indigo-100 dark:border-indigo-900"
    >

  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-6">
    <div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
        <FaBrain className="w-5 h-5 mr-2 text-indigo-600" />
        Backend Intelligence: 12 Student Models
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
        Formula, sample inputs, computed output, and operational flow
      </p>
    </div>
    <div
      className="px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-xs text-indigo-700 dark:text-indigo-300"
      title="This block combines Node analytics models and Flask LSTM prediction models"
    >
      Node analytics + Flask LSTM stack
    </div>
  </div>

  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
    <div
      className="p-4 rounded-xl border border-indigo-100 dark:border-indigo-900 bg-indigo-50/70 dark:bg-indigo-900/20"
      title="Input data consumed by most models"
    >
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
        Sample Input Snapshot
      </p>
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
        Accuracy: {modelSampleContext.sampleAccuracy}%
      </p>
      <p className="text-sm text-gray-700 dark:text-gray-300">
        Avg Difficulty: {Math.round(modelSampleContext.sampleDifficulty * 100)}%
      </p>
      <p className="text-sm text-gray-700 dark:text-gray-300">
        Streak: {modelSampleContext.sampleStreak} days
      </p>
    </div>

    <div
      className="p-4 rounded-xl border border-emerald-100 dark:border-emerald-900 bg-emerald-50/70 dark:bg-emerald-900/20"
      title="Representative derived outputs driving recommendations"
    >
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
        Sample Output Snapshot
      </p>
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
        Efficiency: {modelSampleContext.sampleEfficiency}%
      </p>
      <p className="text-sm text-gray-700 dark:text-gray-300">
        Fatigue Risk: {modelSampleContext.sampleFatigue}%
      </p>
      <p className="text-sm text-gray-700 dark:text-gray-300">
        Recommended Difficulty: {Math.round(recommendedDifficulty * 100)}%
      </p>
    </div>

    <div
      className="p-4 rounded-xl border border-purple-100 dark:border-purple-900 bg-purple-50/70 dark:bg-purple-900/20"
      title="How values move from raw activity to adaptive actions"
    >
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
        Working Flow
      </p>
      <p className="text-sm text-gray-700 dark:text-gray-300">
        Activity logs → Feature engineering → Model scoring → Priority +
        schedule actions
      </p>
    </div>
  </div>

  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
    {modelCardsWithExamples.map((model) => (
      <div
        key={model.id}
        className="p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/70 bg-gray-50 dark:bg-gray-900/30"
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {model.id}. {model.name}
          </h4>
          <span
            className="text-xs text-indigo-600 dark:text-indigo-300"
            title={model.technology}
          >
            <FiInfo className="w-4 h-4" />
          </span>
        </div>

        <p
          className="text-xs text-gray-600 dark:text-gray-300 mb-2"
          title="Primary formula implemented for this model"
        >
          <span className="font-medium">Formula:</span> {model.formula}
        </p>

        <p className="text-xs text-gray-600 dark:text-gray-300 mb-1">
          <span className="font-medium">Sample Input:</span> {model.sampleInput}
        </p>
        <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">
          <span className="font-medium">Sample Output:</span>{" "}
          {model.sampleOutput}
        </p>

        <div className="space-y-1">
          {model.howItWorks.map((step, index) => (
            <p
              key={`${model.id}-step-${index}`}
              className="text-[11px] text-gray-500 dark:text-gray-400"
            >
              {index + 1}. {step}
            </p>
          ))}
        </div>
      </div>
    ))}
  </div>

  <div className="mt-6 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/70 bg-indigo-50/60 dark:bg-indigo-900/20">
    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
      Python LSTM Training Pipeline
    </h4>
    <div className="space-y-1">
      {lstmPipelineSummary.map((line, idx) => (
        <p
          key={`lstm-pipeline-${idx}`}
          className="text-xs text-gray-600 dark:text-gray-300"
        >
          {idx + 1}. {line}
        </p>
      ))}
    </div>
  </div>
</motion.div>
</div>
  )
}

export default backendinfo;
