/*
This file is used obtain user statistics stored in the local storage and plot them.
 */

import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
 
// Register only the bits we need
Chart.register(
  LineController,
  LineElement,
  PointElement,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend
);
 
let stats;
let dataArray;
let cumulativeTimeWindowDuration;
let activityData;
let data;

async function initializeData() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['statistics'], (result) => {
            if (result.statistics !== undefined) {
                data = result.statistics;
            } else {
                data = {
                    dailyBadPostureDuration: 0,
                    dailyDuration: 0,
                    lastUsedDateStr: '',
                    cumulativeTimeWindowDuration: [
                        { name: '12am - 3am', bad: 0, total: 0 },
                        { name: '3am - 6am', bad: 0, total: 0 },
                        { name: '6am - 9am', bad: 0, total: 0 },
                        { name: '9am - 12pm', bad: 0, total: 0 },
                        { name: '12pm - 3pm', bad: 0, total: 0 },
                        { name: '3pm - 6pm', bad: 0, total: 0 },
                        { name: '6pm - 9pm', bad: 0, total: 0 },
                        { name: '9pm - 12am', bad: 0, total: 0 }
                    ],
                    cumulativeWorkDuration: { bad: 0, total: 0 },
                    cumulativeStudyDuration: { bad: 0, total: 0 },
                    cumulativeEntertainmentDuration: { bad: 0, total: 0 },
                    longestGoodPostureDuration: 0,
                    badPosturePercentageLast120Days: [],
                    lowestBadPosturePercentage: undefined,
                    highestBadPosturePercentage: undefined,
                };
            }
            prepareDataForDisplay(data);
            resolve();
        });
    });
}

async function waitForData() {
    await initializeData();
    createChart();
    createTimeWindowChart();
    createActivityChart();
    updateStats();
}

waitForData();

function prepareDataForDisplay(data) {
    // Three statistics
    const hours = Math.floor(data.longestGoodPostureDuration / 3600);
    let minutes = Math.floor((data.longestGoodPostureDuration % 3600) / 60);
    let longestGoodPostureDurationStr;
    if (minutes === 0) {
        longestGoodPostureDurationStr = `${hours}h 00m`;
    } else {
        longestGoodPostureDurationStr = `${hours}h ${minutes}m`;
    }

    let lowestBadPosturePercentageStr;
    let highestBadPosturePercentageStr;
    if (data.lowestBadPosturePercentage === undefined) {
        lowestBadPosturePercentageStr = `--%`
    } else {
        lowestBadPosturePercentageStr = `${Math.round(data.lowestBadPosturePercentage)}%`
    }

    if (data.highestBadPosturePercentage === undefined) {
        highestBadPosturePercentageStr = `--%`
    } else {
        highestBadPosturePercentageStr = `${Math.round(data.highestBadPosturePercentage)}%`
    }

    stats = [
        { id: 'longestGoodPosture', value: longestGoodPostureDurationStr },
        { id: 'lowestBadPosture', value: lowestBadPosturePercentageStr },
        { id: 'highestBadPosture', value: highestBadPosturePercentageStr }
    ];
    
    // Improvement data
    dataArray = data.badPosturePercentageLast120Days;

    // Time window data
    cumulativeTimeWindowDuration = data.cumulativeTimeWindowDuration;

    // Activity data
    activityData = {
        cumulativeWorkDuration: data.cumulativeWorkDuration,
        cumulativeStudyDuration: data.cumulativeStudyDuration,
        cumulativeEntertainmentDuration: data.cumulativeEntertainmentDuration
    };
}

// Function to create the line chart
function createChart() {
    const ctx = document.getElementById('myChart').getContext('2d');
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: dataArray.map((_, index) => index + 1),
            datasets: [{
                label: 'Bad Posture Percentage',
                data: dataArray.map(data => data.badPosturePercentage),
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.5)',
                tension: 0.1,
                pointBackgroundColor: 'rgb(75, 192, 192)',
                pointBorderColor: 'rgb(75, 192, 192)',
                pointHoverRadius: 8,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            aspectRatio: 1, 
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const dataPoint = dataArray[context.dataIndex];

                            function formatDuration(seconds) {
                                const hours = Math.floor(seconds / 3600);
                                const minutes = Math.floor((seconds % 3600) / 60);
                                const secs = seconds % 60;
                                return `${hours}h ${minutes}m ${secs}s`;
                            }

                            const badPostureDurationFormatted = formatDuration(dataPoint.badPostureDuration);
                            const totalDurationFormatted = formatDuration(dataPoint.totalDuration);

                            return [
                                `Date: ${dataPoint.date}`,
                                `Bad Posture Duration: ${badPostureDurationFormatted}`,
                                `Total Duration: ${totalDurationFormatted}`,
                                `Bad Posture Percentage: ${dataPoint.badPosturePercentage}%`
                            ];
                        }
                    }
                },
                title: {
                    display: true,
                    text: 'Bad Posture Percentage Over Last 120 Days',
                    font: { size: 16 }
                }
            },
            layout: {
                padding: {
                    right: 30 // Add padding to the right side
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Bad Posture Percentage',
                        font: { size: 14 }
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Day',
                        font: { size: 14 }
                    }
                }
            }
        }
    });
}

// Function to calculate percentages
function calculatePercentage(bad, total) {
    return total > 0 ? (bad / total) * 100 : 0;
}

// Function to create time window bar chart
function createTimeWindowChart() {
    const ctx = document.getElementById('timeWindowChart').getContext('2d');
    const data = cumulativeTimeWindowDuration.map(item => ({
        name: item.name,
        percentage: calculatePercentage(item.bad, item.total)
    }));

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(item => item.name),
            datasets: [{
                label: 'Bad Posture Percentage',
                data: data.map(item => item.percentage),
                backgroundColor: 'rgba(75, 192, 192, 0.6)',
                borderColor: 'rgb(75, 192, 192)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Average Bad Posture Percentage by Time Window',
                    font: { size: 16 }
                }
            },
            layout: {
                padding: {
                    right: 20  // Add padding to the right side
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { 
                        display: true, 
                        text: 'Percentage', 
                        font: { size: 14} 
                    },
                    max: 100
                }
            }
        }
    });
}

// Function to create activity bar chart
function createActivityChart() {
    const ctx = document.getElementById('activityChart').getContext('2d');
    const data = Object.entries(activityData).map(([key, value]) => ({
        name: key.replace('cumulative', '').replace('Duration', ''),
        percentage: calculatePercentage(value.bad, value.total)
    }));

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(item => item.name),
            datasets: [{
                label: 'Bad Posture Percentage',
                data: data.map(item => item.percentage),
                backgroundColor: 'rgba(255, 99, 132, 0.6)',
                borderColor: 'rgb(255, 99, 132)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Average Bad Posture Percentage by Activity',
                    font: { size: 16 }
                }
            },
            layout: {
                padding: {
                    right: 20  // Add padding to the right side
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { 
                        display: true, 
                        text: 'Percentage', 
                        font: { size: 14} 
                    },
                    max: 100
                }
            }
        }
    });
}

function updateStats() {
    stats.forEach(stat => {
        const element = document.getElementById(stat.id);
        element.textContent = stat.value;
    });
}
