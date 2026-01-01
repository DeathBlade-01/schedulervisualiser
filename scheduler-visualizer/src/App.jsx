import React, { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, Cell } from 'recharts';
import { Download, Settings, TrendingUp, BarChart3, Upload } from 'lucide-react';

const SchedulerVisualizer = () => {
  const [csvData, setCsvData] = useState(null);
  const [selectedTrial, setSelectedTrial] = useState(1);
  const [selectedSchedulers, setSelectedSchedulers] = useState({});
  const [schedulerColors, setSchedulerColors] = useState({});
  const [allSchedulers, setAllSchedulers] = useState([]);
  const [trialsData, setTrialsData] = useState({});
  const [showSettings, setShowSettings] = useState(true);
  const [maxTrials, setMaxTrials] = useState(5);
  
  // Refs for capturing screenshots
  const trialChartsRef = useRef(null);
  const trendsRef = useRef(null);

  const defaultColors = [
    '#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6', '#1ABC9C',
    '#E67E22', '#34495E', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FECA57', '#FF9FF3', '#54A0FF', '#FD79A8', '#00B894', '#74B9FF'
  ];

  const parseCSV = (text) => {
    const lines = text.trim().split('\n');
    const trials = {};
    let currentTrial = null;
    let deadline = null;
    let securityUtility = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('TRIAL RUN')) {
        const match = line.match(/TRIAL RUN (\d+) - DEADLINE == ([\d.]+) SECURITY UTILITY == ([\d.]+)/);
        if (match) {
          currentTrial = parseInt(match[1]);
          deadline = parseFloat(match[2]);
          securityUtility = parseFloat(match[3]);
          trials[currentTrial] = {
            deadline,
            securityUtility,
            schedulers: []
          };
        }
        i++;
        continue;
      }

      if (line && currentTrial && line.includes(',')) {
        const parts = line.split(',');
        if (parts.length === 4 && parts[0] !== 'SCHEDULER') {
          trials[currentTrial].schedulers.push({
            name: parts[0],
            makespan: parseFloat(parts[2]),
            utility: parseFloat(parts[3])
          });
        }
      }
    }

    return trials;
  };

  useEffect(() => {
    const loadStoredData = async () => {
      try {
        const storedSchedulers = await window.storage.get('selected_schedulers');
        const storedColors = await window.storage.get('scheduler_colors');
        
        if (storedSchedulers) {
          setSelectedSchedulers(JSON.parse(storedSchedulers.value));
        }
        if (storedColors) {
          setSchedulerColors(JSON.parse(storedColors.value));
        }
      } catch (error) {
        console.log('No stored data found, using defaults');
      }
    };
    
    loadStoredData();
  }, []);

  useEffect(() => {
    const saveData = async () => {
      try {
        await window.storage.set('selected_schedulers', JSON.stringify(selectedSchedulers));
        await window.storage.set('scheduler_colors', JSON.stringify(schedulerColors));
      } catch (error) {
        console.error('Error saving data:', error);
      }
    };
    
    if (Object.keys(selectedSchedulers).length > 0) {
      saveData();
    }
  }, [selectedSchedulers, schedulerColors]);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        const parsed = parseCSV(text);
        setTrialsData(parsed);
        setMaxTrials(Object.keys(parsed).length);
        
        const schedulerSet = new Set();
        Object.values(parsed).forEach(trial => {
          trial.schedulers.forEach(s => schedulerSet.add(s.name));
        });
        
        const schedulerList = Array.from(schedulerSet).sort();
        setAllSchedulers(schedulerList);
        
        const newSelections = { ...selectedSchedulers };
        const newColors = { ...schedulerColors };
        
        schedulerList.forEach((scheduler, idx) => {
          if (!(scheduler in newSelections)) {
            newSelections[scheduler] = true;
          }
          if (!(scheduler in newColors)) {
            newColors[scheduler] = defaultColors[idx % defaultColors.length];
          }
        });
        
        setSelectedSchedulers(newSelections);
        setSchedulerColors(newColors);
        setCsvData(text);
      };
      reader.readAsText(file);
    }
  };

  const toggleScheduler = (scheduler) => {
    setSelectedSchedulers(prev => ({
      ...prev,
      [scheduler]: !prev[scheduler]
    }));
  };

  const updateColor = (scheduler, color) => {
    setSchedulerColors(prev => ({
      ...prev,
      [scheduler]: color
    }));
  };

  const getCurrentTrialData = () => {
    if (!trialsData[selectedTrial]) return null;
    
    const trial = trialsData[selectedTrial];
    const filtered = trial.schedulers.filter(s => selectedSchedulers[s.name]);
    
    filtered.sort((a, b) => {
      if (Math.abs(a.utility - b.utility) < 0.01) {
        return a.makespan - b.makespan;
      }
      return b.utility - a.utility;
    });
    
    return filtered.map((s, idx) => ({
      ...s,
      rank: idx + 1,
      color: schedulerColors[s.name]
    }));
  };

  const getTrendData = () => {
    const trends = [];
    
    for (let trial = 1; trial <= maxTrials; trial++) {
      if (!trialsData[trial]) continue;
      
      const trialData = { trial };
      
      trialsData[trial].schedulers.forEach(s => {
        if (selectedSchedulers[s.name]) {
          trialData[`${s.name}_makespan`] = s.makespan;
          trialData[`${s.name}_utility`] = s.utility;
        }
      });
      
      trends.push(trialData);
    }
    
    return trends;
  };

  // Capture element as image
  const captureAsImage = async (element, filename) => {
    try {
      const html2canvas = (await import('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/+esm')).default;
      const canvas = await html2canvas(element, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true
      });
      
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      });
    } catch (error) {
      console.error('Error capturing image:', error);
      alert('Error capturing image. Please try again.');
    }
  };

  // Export all trials as images
  const exportAllTrialsAsImages = async () => {
    if (!trialsData) return;
    
    alert('Starting export... This may take a moment. Images will download one by one.');
    
    // Export each trial
    for (let trial = 1; trial <= maxTrials; trial++) {
      if (!trialsData[trial]) continue;
      
      setSelectedTrial(trial);
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait for render
      
      if (trialChartsRef.current) {
        await captureAsImage(trialChartsRef.current, `trial_${trial}_comparison.png`);
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    
    // Export trends
    if (trendsRef.current) {
      await captureAsImage(trendsRef.current, 'performance_trends.png');
    }
    
    alert('Export complete! Check your downloads folder.');
  };

  // Export text report
  const exportTextReport = () => {
    if (!trialsData) return;
    
    let exportText = 'SCHEDULER PERFORMANCE REPORT\n';
    exportText += '='.repeat(80) + '\n\n';
    
    for (let trial = 1; trial <= maxTrials; trial++) {
      if (!trialsData[trial]) continue;
      
      exportText += `TRIAL RUN ${trial}\n`;
      exportText += `Deadline: ${trialsData[trial].deadline}\n`;
      exportText += `Min Security Utility: ${trialsData[trial].securityUtility}\n`;
      exportText += '-'.repeat(80) + '\n';
      exportText += 'Rank | Scheduler | Makespan | Utility\n';
      exportText += '-'.repeat(80) + '\n';
      
      const filtered = trialsData[trial].schedulers.filter(s => selectedSchedulers[s.name]);
      filtered.sort((a, b) => {
        if (Math.abs(a.utility - b.utility) < 0.01) {
          return a.makespan - b.makespan;
        }
        return b.utility - a.utility;
      });
      
      filtered.forEach((s, idx) => {
        exportText += `${idx + 1} | ${s.name} | ${s.makespan.toFixed(2)} | ${s.utility.toFixed(2)}\n`;
      });
      
      exportText += '\n\n';
    }
    
    const blob = new Blob([exportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'scheduler_report.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const currentData = getCurrentTrialData();
  const trendData = getTrendData();
  const selectedSchedulersList = allSchedulers.filter(s => selectedSchedulers[s]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-slate-800 mb-4 flex items-center gap-3">
            <BarChart3 className="text-blue-600" size={36} />
            Scheduler Performance Visualizer
          </h1>
          
          <div className="flex gap-4 items-center flex-wrap">
            <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition">
              <Upload size={20} />
              Upload CSV
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            
            {csvData && (
              <>
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition"
                >
                  <Settings size={20} />
                  {showSettings ? 'Hide' : 'Show'} Settings
                </button>
                
                <button
                  onClick={exportAllTrialsAsImages}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                >
                  <Download size={20} />
                  Export as Images
                </button>
                
                <button
                  onClick={exportTextReport}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                  <Download size={20} />
                  Export Text Report
                </button>
              </>
            )}
          </div>
        </div>

        {csvData && (
          <>
            {/* Settings Panel */}
            {showSettings && (
              <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
                <h2 className="text-xl font-bold text-slate-800 mb-4">Settings</h2>
                
                <div>
                  <h3 className="text-lg font-semibold text-slate-700 mb-3">
                    Select Schedulers ({selectedSchedulersList.length} selected)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto p-4 bg-slate-50 rounded-lg">
                    {allSchedulers.map(scheduler => (
                      <div key={scheduler} className="flex items-center gap-3 p-2 bg-white rounded border border-slate-200">
                        <input
                          type="checkbox"
                          checked={selectedSchedulers[scheduler] || false}
                          onChange={() => toggleScheduler(scheduler)}
                          className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="color"
                          value={schedulerColors[scheduler] || '#000000'}
                          onChange={(e) => updateColor(scheduler, e.target.value)}
                          className="w-10 h-8 rounded cursor-pointer"
                        />
                        <span className="text-sm text-slate-700 flex-1 truncate" title={scheduler}>
                          {scheduler}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Trial Selection - Now above charts */}
            {currentData && currentData.length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-6 mb-6" ref={trialChartsRef}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold text-slate-800">
                    Trial Run {selectedTrial} - Performance Comparison
                  </h2>
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-semibold text-slate-700">
                      Select Trial:
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={maxTrials}
                      value={selectedTrial}
                      onChange={(e) => setSelectedTrial(parseInt(e.target.value))}
                      className="w-20 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <span className="text-slate-600">of {maxTrials}</span>
                  </div>
                </div>
                
                <p className="text-slate-600 mb-4">
                  Deadline: {trialsData[selectedTrial].deadline.toFixed(2)} | 
                  Min Security Utility: {trialsData[selectedTrial].securityUtility.toFixed(2)}
                </p>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Makespan Chart */}
                  <div>
                    <h3 className="text-lg font-semibold text-slate-700 mb-3">
                      Makespan (Lower is Better)
                    </h3>
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={currentData} layout="vertical" margin={{ left: 150 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis type="category" dataKey="name" width={140} />
                        <Tooltip />
                        <Bar dataKey="makespan">
                          {currentData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Security Utility Chart */}
                  <div>
                    <h3 className="text-lg font-semibold text-slate-700 mb-3">
                      Security Utility (Higher is Better)
                    </h3>
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={currentData} layout="vertical" margin={{ left: 150 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis type="category" dataKey="name" width={140} />
                        <Tooltip />
                        <Bar dataKey="utility">
                          {currentData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Rankings Table */}
                <div className="mt-6 overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="border border-slate-300 px-4 py-2 text-left">Rank</th>
                        <th className="border border-slate-300 px-4 py-2 text-left">Scheduler</th>
                        <th className="border border-slate-300 px-4 py-2 text-right">Makespan</th>
                        <th className="border border-slate-300 px-4 py-2 text-right">Utility</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentData.map((item) => (
                        <tr key={item.name} className="hover:bg-slate-50">
                          <td className="border border-slate-300 px-4 py-2 font-semibold">{item.rank}</td>
                          <td className="border border-slate-300 px-4 py-2">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-4 h-4 rounded"
                                style={{ backgroundColor: item.color }}
                              />
                              {item.name}
                            </div>
                          </td>
                          <td className="border border-slate-300 px-4 py-2 text-right">
                            {item.makespan.toFixed(2)}
                          </td>
                          <td className="border border-slate-300 px-4 py-2 text-right">
                            {item.utility.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Trend Charts */}
            {trendData.length > 0 && selectedSchedulersList.length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-6" ref={trendsRef}>
                <h2 className="text-2xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <TrendingUp className="text-blue-600" />
                  Performance Trends Across Trials
                </h2>

                <div className="space-y-8">
                  {/* Makespan Trend */}
                  <div>
                    <h3 className="text-lg font-semibold text-slate-700 mb-3">
                      Makespan Trends
                    </h3>
                    <ResponsiveContainer width="100%" height={400}>
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="trial" label={{ value: 'Trial Run', position: 'insideBottom', offset: -5 }} />
                        <YAxis label={{ value: 'Makespan', angle: -90, position: 'insideLeft' }} />
                        <Tooltip />
                        <Legend />
                        {selectedSchedulersList.map(scheduler => (
                          <Line
                            key={scheduler}
                            type="monotone"
                            dataKey={`${scheduler}_makespan`}
                            name={scheduler}
                            stroke={schedulerColors[scheduler]}
                            strokeWidth={2}
                            dot={{ r: 4 }}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Security Utility Trend */}
                  <div>
                    <h3 className="text-lg font-semibold text-slate-700 mb-3">
                      Security Utility Trends
                    </h3>
                    <ResponsiveContainer width="100%" height={400}>
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="trial" label={{ value: 'Trial Run', position: 'insideBottom', offset: -5 }} />
                        <YAxis label={{ value: 'Security Utility', angle: -90, position: 'insideLeft' }} />
                        <Tooltip />
                        <Legend />
                        {selectedSchedulersList.map(scheduler => (
                          <Line
                            key={scheduler}
                            type="monotone"
                            dataKey={`${scheduler}_utility`}
                            name={scheduler}
                            stroke={schedulerColors[scheduler]}
                            strokeWidth={2}
                            dot={{ r: 4 }}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {!csvData && (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <Upload className="mx-auto text-slate-400 mb-4" size={64} />
            <h2 className="text-2xl font-bold text-slate-800 mb-2">No Data Loaded</h2>
            <p className="text-slate-600">Upload a CSV file to begin visualization</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SchedulerVisualizer;