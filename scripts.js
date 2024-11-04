let users = [];

// Load users data from the JSON file
fetch('/users.json')
    .then(response => response.json())
    .then(data => {
        users = data;  // Assign loaded data to the users variable
    })
    .catch(error => {
        console.error('Error loading users:', error);
    });

// Function to get token by matching username and phone number
function getUserToken(username, phoneNumber) {
    const user = users.find(u => u.username === username && u.phoneNumber === phoneNumber);
    if (user) {
        return user.token;
    } else {
        alert('Matching user not found. Try again!');
        return;
    }
}



// Handle login
$('#login_btn').click(function () {
    const username = $('#username').val();
    const phoneNumber = $('#phoneNumber').val();

    // Get token based on username and phone number
    const token = getUserToken(username, phoneNumber);
    if (token) {
        localStorage.setItem('userToken', token);
        localStorage.setItem('username', username);
        localStorage.setItem('phoneNumber', phoneNumber);
        const wsurl = "wss://172.27.229.25/xuc/api/2.0/cti?token=" + token;
        Cti.WebSocket.init(wsurl, username, phoneNumber);
        window.location.href = "./index.html";
    } else {
        console.log("Token not found");
    }
});

// Handle logout
$('#logout_btn').click(function () {
    // Clear session items
    localStorage.removeItem('userToken');
    localStorage.removeItem('username');
    localStorage.removeItem('phoneNumber');

    Cti.logoutAgent();
    console.log("Logged out.");
    window.location.href = "./signin.html";
});


/* START OF AGENTS PAGE agents.html */
// get queue membership
function processQueueMemberships() {
    // Handle incoming QueueList and QueueMemberList messages
    Cti.getList("queue");
    Cti.getList("queuemember");
    Cti.getAgentStates();

    // Attach the Cti.receive function to handle incoming events
    Cti.receive = function (event) {
        const data = JSON.parse(event.data);
        // Check for QueueList messages
        if (data.msgType === "QueueList") {
            console.log("Received Queue List: ", data.ctiMessage);
            // Map queueId to queueName
            data.ctiMessage.forEach(queue => {
                queueMap[queue.id] = queue.name;
                console.log(`Queue ID ${queue.id}: ${queue.name}`); // Log each queue
            });

            // Check for QueueMemberList messages
        } else if (data.msgType === "QueueMemberList") {
            console.log("Received Queue Membership List: ", data.ctiMessage);
            queueMembership = {};
            // Organize queue memberships by agentId
            data.ctiMessage.forEach(member => {
                const { queueId, agentId } = member;
                // Initialize empty array for agent if not present
                if (!queueMembership[agentId]) {
                    queueMembership[agentId] = [];
                }

                // Add queueId to the agent's list of queues
                queueMembership[agentId].push(queueId);
            });

            // Log the entire queueMembership object for debugging
            console.log("Complete Queue Membership Object:", queueMembership);
            // Update agent table with queue memberships by name
            const agentRows = document.querySelectorAll("#agentTable tbody tr");
            agentRows.forEach(row => {
                const agentId = row.querySelector('td:first-child').innerText;
                console.log("Processing row for agent ID:", agentId);
                // If the agent has any queue memberships, display the queue names
                if (queueMembership[agentId]) {
                    const queueNames = queueMembership[agentId]
                        .map(queueId => `${queueMap[queueId] || 'Unknown Queue'}`) // Map queueId to queue name
                        .join(', '); // Join queue names with commas
                    row.querySelector(".queue-memberships").textContent = queueNames;

                    // Log the mapped queue names and agent ID
                    console.log("----------------------------------------", queueNames, agentId);
                } else {
                    row.querySelector(".queue-memberships").textContent = "No Queues";
                    console.log("Agent", agentId, "has no queue memberships.");
                }
            });
        } else if (data.msgType === "AgentStateEvent") {
            const agentsId = data.msgType.agentId;
            const status = data.msgType.name;
            const since = data.msgType.since;

            // Loop through each row to match the agent's ID manually
            let rows = document.querySelectorAll('#agentTable tbody tr');
            rows.forEach(row => {
                const agentNumber = row.querySelector('td:nth-child(9)').innerText;
                const rowAgentId = row.querySelector('td:first-child').innerText;

                if (parseInt(rowAgentId) === agentsId) {
                    // row.querySelector('.status').innerText = status;
                    const statusCell = row.querySelector('.status');
                    statusCell.innerText = status;

                    // One-line if statement to set the Bootstrap class
                    statusCell.className = status === "AgentLoggedOut" ? 'status bg-danger' : status === "AgentReady" ? 'status bg-success' : 'status';
                    console.log(`Updated status for agent ID ${agentsId} (Number: ${agentNumber}): ${status}`);
                }
            });
        }
    };
}

// Fill agents details in the table
function getConfigAgents() {
    // Subscribe to the AgentList topic
    Cti.getList("agent");
    Cti.Topic("AgentList").subscribe((response) => {
        if (response) {
            console.log(response);
            // Store the agent list globally
            agentList = response;

            const tableBody = document.querySelector("#agentTable tbody");
            tableBody.innerHTML = '';
            const agentCount = response.length;
            document.querySelector('.card-title.mb-0').innerText = agentCount;
            // Iterate over each agent and insert a row into the table
            response.forEach(agent => {
                const row = `
                    <tr data-agent-number="${agent.id}">
                        <td class="text-start">${agent.id}</td>
                        <td class="text-start">${agent.number}</td>
                        <td class="text-start">${agent.firstName} ${agent.lastName}</td>
                        <td class="answered-calls">0</td>
                        <td class="received-calls">0</td>
                        <td class="unanswered-calls">0</td>
                        <td class="answer-rate">0%</td>
                        <td class="status">N/A</td>
                        <td class="last-call">N/A</td>
                        <td class="avg-call-length">00:00</td>
                        <td class="on-call">0%</td>
                        <td class="efficiency">0%</td>
                         <td class="outbound-calls"></td> 
                    </tr>
                `;
                tableBody.insertAdjacentHTML('beforeend', row);
            });
            updateAgentStatisticsTable(agentCount);
        }
    });
}

// update agent stats in agents.html
async function updateAgentStatisticsTable(totalAgentsCount) {
    try {
        // Fetch all agent statistics
        const { agentStatistics, outboundStatistics, longestCallDuration, longestCallAgentId, agentUtilization } = await fetchAllAgentStatistics(totalAgentsCount);
        console.log("Agent Statistics:", agentStatistics);
        Object.keys(agentStatistics).forEach(agentId => {
            let stats = agentStatistics[agentId];
            let row = document.querySelector(`#agentTable tbody tr[data-agent-number="${String(agentId)}"]`);
            if (row) {
                // Update inbound calls (received calls) statistics
                row.querySelector('.received-calls').innerText = stats.totalCalls;

                // Get outbound calls from the outbound statistics object
                const outboundStats = outboundStatistics[agentId] || { totalOutboundCalls: 0 };
                row.querySelector('.outbound-calls').innerText = outboundStats.totalOutboundCalls;

                // Update answered and unanswered calls (inbound only)
                row.querySelector('.answered-calls').innerText = stats.answeredCalls;
                row.querySelector('.unanswered-calls').innerText = stats.unansweredCalls;

                // Calculate and update answer rate (only for inbound calls)
                let answerRate = (stats.answeredCalls / stats.totalCalls) * 100 || 0;
                row.querySelector('.answer-rate').innerText = answerRate.toFixed(2) + '%';

                // Calculate and update average call length (in minutes, inbound only)
                const averageCallLengthSeconds = stats.answeredCalls > 0 ? (stats.totalTalkTime / stats.answeredCalls) : 0;
                const averageCallLengthMinutes = (averageCallLengthSeconds / 60).toFixed(2);
                row.querySelector('.avg-call-length').innerText = averageCallLengthMinutes;

                // Calculate and update agent efficiency (utilization based on time)
                const todayAt7AM = new Date();
                todayAt7AM.setHours(7, 0, 0, 0);
                const totalAvailableTime = (Date.now() - todayAt7AM) / 1000;
                const agentEfficiency = totalAvailableTime > 0 ? ((stats.totalTalkTime / totalAvailableTime) * 100).toFixed(2) : 0;
                row.querySelector('.efficiency').innerText = agentEfficiency + '%';

                // Update the last call time for this agent
                row.querySelector('.last-call').innerText = stats.lastCallTime ? new Date(stats.lastCallTime).toLocaleString() : 'N/A';

                // Update the total minutes the agent has been on calls
                const totalMinutesOnCall = stats.totalTalkTime / 60;
                row.querySelector('.on-call').innerText = totalMinutesOnCall.toFixed(2) + ' min';
            } else {
                console.warn(`No row found for agent number: ${agentId}`);
            }
        });

        let totalOutboundCalls = 0;
        Object.keys(outboundStatistics).forEach(outboundAgentId => {
            totalOutboundCalls += outboundStatistics[outboundAgentId].totalOutboundCalls || 0;
        });

        // Update agent utilization and longest call duration
        document.querySelector('.outBoundCalls').innerText = totalOutboundCalls;
        document.querySelector('.agent-utilization-card').innerText = agentUtilization;
        document.querySelector('.longest-call').innerText = formatDuration(longestCallDuration);
    } catch (error) {
        console.error("Error in updateAgentStatisticsTable:", error);
    }
    subscribeToAgentStatus();
}

// Process agents data and fill table in agents.html
async function fetchAllAgentStatistics(totalAgentsCount) {
    try {
        // Fetch call logs and wait for resolution
        await initializeUserAgentMap();
        const callLogs = await fetchData('call_logs');

        let agentStatistics = {};
        let outboundStatistics = {};
        let longestCallDuration = 0;
        let longestCallAgentId = null;
        let uniqueAgents = new Set();
        const today = new Date();
        const sevenAM = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 7, 0, 0, 0);

        // Use a for...of loop to await asynchronous operations
        for (const log of callLogs) {
            const logDate = new Date(log.date);

            if (logDate >= sevenAM) {
                // Check inbound call using destination_line_identity
                const inboundAgentId = await extractAgent(log.destination_line_identity);
                if (inboundAgentId) {
                    uniqueAgents.add(inboundAgentId);
                    // Initialize the agent entry if not already present
                    if (!agentStatistics[inboundAgentId]) {
                        agentStatistics[inboundAgentId] = {
                            totalCalls: 0,
                            answeredCalls: 0,
                            unansweredCalls: 0,
                            totalTalkTime: 0,
                            lastCallTime: null,
                            averageHandleTime: 0,
                            totalHandleTime: 0,
                            efficiency: '0%',
                            inboundTimeLogs: []
                        };
                    }

                    // Update inbound call statistics
                    agentStatistics[inboundAgentId].totalCalls += 1;
                    if (log.answered) {
                        agentStatistics[inboundAgentId].answeredCalls += 1;
                    } else {
                        agentStatistics[inboundAgentId].unansweredCalls += 1;
                    }

                    // Convert the duration to seconds and add to totalTalkTime
                    const totalSeconds = log.duration; // assuming log.duration is in seconds
                    agentStatistics[inboundAgentId].totalTalkTime += totalSeconds;

                    // Calculate handle time for this call
                    const handleTime = totalSeconds + 30; // Adding 30 seconds as handling time
                    agentStatistics[inboundAgentId].totalHandleTime += handleTime;

                    // Update longest call if this call is longer
                    if (totalSeconds > longestCallDuration) {
                        longestCallDuration = totalSeconds;
                        longestCallAgentId = inboundAgentId;
                    }

                    // Add the call start time to the timeLogs
                    agentStatistics[inboundAgentId].inboundTimeLogs.push(log.date);

                    // get timestamps
                    if (!agentStatistics[inboundAgentId].lastCallTime || logDate > new Date(agentStatistics[inboundAgentId].lastCallTime)) {
                        agentStatistics[inboundAgentId].lastCallTime = log.date;
                    }

                    // Update last call time if the current log's date is more recent
                    if (!agentStatistics[inboundAgentId].lastCallTime || logDate > new Date(agentStatistics[inboundAgentId].lastCallTime)) {
                        agentStatistics[inboundAgentId].lastCallTime = log.date;
                    }
                }

                // Check outbound call using source_line_identity
                const outboundAgentId = await extractAgent(log.source_line_identity);
                if (outboundAgentId) {
                    uniqueAgents.add(outboundAgentId); // Add outbound agent to unique set
                    // Initialize the agent entry in outbound statistics if not already present
                    if (!outboundStatistics[outboundAgentId]) {
                        outboundStatistics[outboundAgentId] = {
                            totalOutboundCalls: 0,
                            totalOutboundTalkTime: 0,
                            lastOutboundCallTime: null,
                            averageOutboundHandleTime: 0,
                            outboundEfficiency: '0%',
                            outboundTimeLogs: [],
                        };
                    }

                    // Increment outbound calls and total talk time
                    outboundStatistics[outboundAgentId].totalOutboundCalls += 1;

                    const outboundDuration = log.duration; // assuming log.duration is in seconds
                    outboundStatistics[outboundAgentId].totalOutboundTalkTime += outboundDuration;

                    // Calculate handle time for this outbound call
                    const outboundHandleTime = outboundDuration + 30; // Adding 30 seconds as handling time
                    outboundStatistics[outboundAgentId].averageOutboundHandleTime += outboundHandleTime; // Update total outbound handle time

                    // Update last outbound call time if the current log's date is more recent
                    if (!outboundStatistics[outboundAgentId].lastOutboundCallTime || logDate > new Date(outboundStatistics[outboundAgentId].lastOutboundCallTime)) {
                        outboundStatistics[outboundAgentId].lastOutboundCallTime = log.date;
                    }

                    // Add the call start time to the outbound timeLogs
                    outboundStatistics[outboundAgentId].outboundTimeLogs.push(log.date);

                    // pass timestamps
                    if (!outboundStatistics[outboundAgentId].lastOutboundCallTime || logDate > new Date(outboundStatistics[outboundAgentId].lastOutboundCallTime)) {
                        outboundStatistics[outboundAgentId].lastOutboundCallTime = log.date;
                    }
                }
            }
        }

        const workedSeconds = (today - sevenAM) / 1000;

        // Calculate average handle time and efficiency for inbound agents
        for (const agentId in agentStatistics) {
            const stats = agentStatistics[agentId];
            if (stats.totalCalls > 0) {
                stats.averageHandleTime = (stats.totalHandleTime / stats.totalCalls).toFixed(2);
                const efficiency = (stats.totalTalkTime / workedSeconds) * 100; // Convert to percentage
                stats.efficiency = efficiency.toFixed(2) + '%';
            }
        }

        // Calculate average handle time and efficiency for outbound agents
        for (const outboundId in outboundStatistics) {
            const stats = outboundStatistics[outboundId];
            if (stats.totalOutboundCalls > 0) {
                stats.averageOutboundHandleTime = (stats.averageOutboundHandleTime / stats.totalOutboundCalls).toFixed(2); // Calculate average
                const outboundEfficiency = (stats.totalOutboundTalkTime / workedSeconds) * 100; // Convert to percentage
                stats.outboundEfficiency = outboundEfficiency.toFixed(2) + '%';
            }
        }

        // Prepare the final output
        const uniqueAgentCount = uniqueAgents.size;
        const agentUtilization = (uniqueAgentCount / totalAgentsCount) * 100;

        return {
            agentStatistics,
            outboundStatistics,
            longestCallDuration,
            longestCallAgentId,
            agentUtilization: agentUtilization.toFixed(2) + '%',
        };

    } catch (error) {
        console.error("Error in fetchAllAgentStatistics:", error);
        throw error;
    }
}

// Initialize mapping agent username to ID from PBX api
let userAgentMap = {};
async function initializeUserAgentMap() {
    const data = await fetchDataFromPbx();
    console.log("Fetched user data from PBX API:", data);
    // Populate userAgentMap with username-agentID pairs
    data.items.forEach(user => {
        if (user.username && user.agentid) {
            userAgentMap[user.username] = user.agentid;
        }
    });
}

// Modify extractAgent to use the pre-fetched userAgentMap
function extractAgent(identity) {
    if (typeof identity === "string") {
        console.log("Processing identity:", identity);

        if (identity.startsWith("local/id-")) {
            const agentId = identity.split("@")[0].split("-")[1];
            console.log("Extracted agent ID from local/id- format:", agentId);
            return agentId; // Return agent ID directly
        } else if (identity.startsWith("sip/")) {
            const username = identity.split("/")[1];
            const mappedAgentId = userAgentMap[username] || null;
            console.log("Extracted username from sip/ format:", username);
            console.log("Mapped agent ID for username:", mappedAgentId);
            // Return the agent ID from the userAgentMap if it exists
            return mappedAgentId;
        }
    }

    console.log("No valid agent ID found for identity:", identity);
    return null;
}


// Fetch data from Fleet server, specifying either "call_logs" or "queue_logs"
async function fetchData(logType = 'call_logs') {
    return fetch('http://172.27.177.201:50620/data')
        .then(function (response) {
            if (!response.ok) {
                throw new Error('HTTP error! Status: ' + response.status);
            }
            return response.json();
        })
        .then(function (data) {
            // Return the specified log type
            return data[logType] || [];
        })
        .catch(function (error) {
            console.error("Error fetching data: ", error);
            return [];
        });
}

// Get user data from api to match agent ID
async function fetchDataFromPbx() {
    return fetch('https://172.27.189.172:9486/1.1/users', {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'X-Auth-Token': '2a916369-472d-4563-81d7-4c547e7694e9'
        }
    })
        .then(function (response) {
            if (!response.ok) {
                throw new Error('HTTP error! Status: ' + response.status);
            }
            return response.json();
        })
        .catch(function (error) {
            console.error("Error fetching data: ", error);
            return { items: [] };
        });
}

// Subscribe to agents Status
function subscribeToAgentStatus() {
    // Subscribe to the WebSocket for agent status updates
    Cti.getAgentStates();
    Cti.Topic("AgentStateEvent").subscribe(function (response) {
        if (response) {
            const agentId = response.agentId;
            const status = response.name;
            const since = response.since;

            // Loop through each row to match the agent's ID manually
            let rows = document.querySelectorAll('#agentTable tbody tr');
            rows.forEach(row => {
                const agentNumber = row.querySelector('td:nth-child(9)').innerText;
                const rowAgentId = row.querySelector('td:first-child').innerText;

                if (parseInt(rowAgentId) === agentId) {
                    // row.querySelector('.status').innerText = status;
                    const statusCell = row.querySelector('.status');
                    statusCell.innerText = status;

                    // One-line if statement to set the Bootstrap class
                    statusCell.className = status === "AgentLoggedOut" ? 'status bg-danger' : status === "AgentReady" ? 'status bg-success' : 'status';
                    console.log(`Updated status for agent ID ${agentId} (Number: ${agentNumber}): ${status}`);
                }
            });
        }
    });

    // processQueueMemberships();
}

// search agents table by name or number
function searchTable() {
    // Get the input values
    var nameInput = document.getElementById('nameSearchInput').value.toLowerCase();
    var numberInput = document.getElementById('numberSearchInput').value.toLowerCase();
    var table = document.getElementById('agentTable');
    var tr = table.getElementsByTagName('tr');
    var noMatch = true;

    // Loop through all table rows (except headers), and hide those that don't match the query
    for (var i = 1; i < tr.length; i++) {
        var tdName = tr[i].getElementsByTagName('td')[2]; // Name column (3rd column)
        var tdNumber = tr[i].getElementsByTagName('td')[1]; // Number column (2nd column)

        if (tdName && tdNumber) {
            var nameValue = tdName.textContent || tdName.innerText;
            var numberValue = tdNumber.textContent || tdNumber.innerText;

            // Check if name starts with the input or number starts with the input
            if (nameValue.toLowerCase().startsWith(nameInput) && numberInput === '' ||
                numberValue.toLowerCase().startsWith(numberInput) && nameInput === '' ||
                nameValue.toLowerCase().startsWith(nameInput) && numberValue.toLowerCase().startsWith(numberInput)) {
                tr[i].style.display = ""; // Show row
                noMatch = false; // At least one match found
            } else {
                tr[i].style.display = "none"; // Hide row
            }
        }
    }

    // Display a "No matches so far" message if no rows match
    if (noMatch) {
        // Add a row for "No matches so far" if not already present
        var noMatchRow = document.getElementById('noMatchRow');
        if (!noMatchRow) {
            var tbody = table.getElementsByTagName('tbody')[0];
            var row = table.insertRow();
            row.id = 'noMatchRow';
            var cell = row.insertCell(0);
            cell.colSpan = table.rows[0].cells.length;
            cell.style.textAlign = 'center';
            cell.innerHTML = 'No matches so far';
        }
    } else {
        // Remove the "No matches so far" row if matches are found
        var noMatchRow = document.getElementById('noMatchRow');
        if (noMatchRow) {
            noMatchRow.parentNode.removeChild(noMatchRow);
        }
    }
}




/* Start of queues.html */
// Define team to queue ID mapping
const teamQueueMapping = {
    users: [19, 30, 23, 26, 27, 22, 34, 32, 17, 33, 21, 28],
    fas: [10, 14],
    apolloincoming: [2, 1, 7]
};

// Function to get the list of queues
function getConfigQueues() {
    const teamDropdown = document.querySelector("#teamDropdown");
    const selectedTeam = teamDropdown.value;

    if (!selectedTeam) {
        console.log("No team selected");
        return;
    }

    // Get associated queue IDs for the selected team
    const queueIds = teamQueueMapping[selectedTeam];
    console.log("Queue IDs for selected team:", queueIds);

    // Fetch the list of queues
    Cti.getList('queue');
    Cti.receive = function (event) {
        const data = JSON.parse(event.data);
        console.log("Received message: ", data);
        // Check if the message type is 'QueueList'
        if (data.msgType === "QueueList") {
            const queues = data.ctiMessage;

            // Filter queues based on selected team's queue IDs
            const filteredQueues = queues.filter(queue => queueIds.includes(queue.id));
            console.log("Filtered Queues for Team:", filteredQueues);
            // Populate the statistics table with queue data
            getQueueStats(filteredQueues);
        }
    };
}

// fetch queue stats for selected queues
function getQueueStats(filteredQueues) {
    const tbody = document.querySelector("#queueStatsTable tbody");
    tbody.innerHTML = '';
    const scoreCard = document.querySelector(".percentage");
    let maxWaitingTime = 0;
    let totalAnsweredCalls = 0;
    let totalCallsEntered = 0;
    console.log("Am inside queueStats, now here are my filtered values", filteredQueues);
    // Object to store queueId mapped to array of agentIds
    let queueMembership = {};
    // Subscribe to queue statistics and membership
    Cti.getList("queuemember");
    Cti.subscribeToQueueStats();
    // Attach the onmessage handler to handle both queue statistics and queue membership
    Cti.receive = function (event) {
        const data = JSON.parse(event.data);
        console.log("Received message: ", data);
        //Check the message type
        if (data.msgType === "QueueStatistics") {
            let statistics = data.ctiMessage;
            console.log("Received statistics for Queue:>>>>>>>>>>>>>>>>>>>>>>>>>", statistics);
            // Loop through filteredQueues and check for matching queue IDs
            filteredQueues.forEach(queue => {
                if (parseInt(statistics.queueId) === parseInt(queue.id)) {
                    console.log("this matched", statistics.queueId, "++++++++++++++++++++++++++++++++++");
                    let counters = statistics.counters;
                    // Update maxWaitingTime if the current LongestWaitTime is greater
                    const longestWaitTime = getCounterValue(counters, 'EWT');
                    if (longestWaitTime > maxWaitingTime) {
                        maxWaitingTime = longestWaitTime;
                    }

                    // Update answered calls and calls entered for efficiency calculation
                    totalAnsweredCalls += getCounterValue(counters, 'TotalNumberCallsAnswered');
                    totalCallsEntered += getCounterValue(counters, 'TotalNumberCallsEntered');
                    let existingRow = document.querySelector(`tr[data-queue-id="${statistics.queueId}"]`);
                    if (existingRow) {
                        // Update existing row
                        counters.forEach(counter => {
                            let statName = counter.statName;
                            let value = counter.value;
                            switch (statName) {
                                case "EWT":
                                    existingRow.querySelector('.ewt').textContent = value || 0;
                                    break;
                                case "WaitingCalls":
                                    existingRow.querySelector('.waitingCalls').textContent = value || 0;
                                    break;
                                case "TalkingAgents":
                                    existingRow.querySelector('.talkingAgents').textContent = value || 0;
                                    break;
                                case "AvailableAgents":
                                    existingRow.querySelector('.available').textContent = value || 0;
                                    break;
                                case "LoggedAgents":
                                    existingRow.querySelector('.loggedIn').textContent = value || 0;
                                    break;
                                case "TotalNumberCallsEntered":
                                    existingRow.querySelector('.received').textContent = value || 0;
                                    break;
                                case "TotalNumberCallsAbandonned":
                                    existingRow.querySelector('.abandoned').textContent = value || 0;
                                    break;
                                case "TotalNumberCallsAnswered":
                                    existingRow.querySelector('.answered').textContent = value || 0;
                                    break;
                                case "PercentageAnsweredTotal":
                                    existingRow.querySelector('.percentage').textContent = `${parseFloat(value).toFixed(1)}%` || '0';
                                    break;
                                case "LongestWaitTime":
                                    existingRow.querySelector('.longestWaitTime').textContent = value || 0;
                                    break;
                            }
                        });
                    } else {
                        // Create a new row with all the necessary columns
                        const newRow = `
                            <tr data-queue-id="${statistics.queueId}">
                                <td>${statistics.queueId}</td>
                                <td>${queue.number}</td>
                                <td>${queue.name || 'N/A'}</td>
                                <td class="waitingCalls">${getCounterValue(counters, 'WaitingCalls') || 0}</td>
                                <td class="talkingAgents">${getCounterValue(counters, 'TalkingAgents') || 0}</td>
                                <td class="available">${getCounterValue(counters, 'AvailableAgents') || 0}</td>
                                <td class="loggedIn">${getCounterValue(counters, 'LoggedAgents') || 0}</td>
                                <td class="ewt">${getCounterValue(counters, 'EWT') || 0}</td>
                                <td class="received">${getCounterValue(counters, 'TotalNumberCallsEntered') || 0}</td>
                                <td class="abandoned">${getCounterValue(counters, 'TotalNumberCallsAbandonned') || 0}</td>
                                <td class="answered">${getCounterValue(counters, 'TotalNumberCallsAnswered') || 0}</td>
                                <td class="percentage">${getCounterValue(counters, 'PercentageAnsweredTotal') || '0%'}</td>
                                <td class="longestWaitTime">${getCounterValue(counters, 'LongestWaitTime') || 0}</td>
                                <td class="totalAgents">${queueMembership[statistics.queueId] ? queueMembership[statistics.queueId].length : 0}</td> 
                            </tr>
                        `;
                        tbody.insertAdjacentHTML('beforeend', newRow);
                    }
                }
            });
            // Update efficiency score card after processing all statistics
            console.log("Here is data for call efficiency total calls is: ", totalAnsweredCalls, "And total calls answered", totalCallsEntered);
            const efficiency = totalCallsEntered > 0 ? ((totalAnsweredCalls / totalCallsEntered) * 100).toFixed(1) : 0;
            scoreCard.textContent = `${efficiency}%`;
            const scoreCardElement = document.querySelector(".LongestWaitTime");
            scoreCardElement.textContent = `${maxWaitingTime} sec.`;
        } else if (data.msgType === "QueueMemberList") {
            let queueData = data.ctiMessage;
            console.log("Received membership data for Queue:>>>>>>>>>>>>>>>>>>>>>>>>>", queueData);
            queueData.forEach(member => {
                const { queueId, agentId } = member;
                // If the queueId doesn't exist in the object, initialize it as an empty array
                if (!queueMembership[queueId]) {
                    queueMembership[queueId] = [];
                }
                // Add the agentId to the corresponding queueId
                queueMembership[queueId].push(agentId);
            });
            // Update the UI to reflect the new total agent count
            filteredQueues.forEach(queue => {
                let existingRow = document.querySelector(`tr[data-queue-id="${queue.id}"]`);
                if (existingRow && queueMembership[queue.id]) {
                    // Update the total agents column in the existing row
                    existingRow.querySelector('.totalAgents').textContent = queueMembership[queue.id].length;
                }
            });
        }
    };

    // Helper function to extract a counter value by name
    function getCounterValue(counters, statName) {
        let stat = counters.find(counter => counter.statName === statName);
        return stat ? stat.value : 0;
    }

}

const myAgentsList = [];
// HOME PAGE - index.html
// Get call distribution to plot pie chats and line graphs
function callDistribution() {
    Cti.getQueueCallHistory('9', 100);
    Cti.getList('queue');
    Cti.getList("agent");
    const queueCallCount = {};
    const agentCount = {};
    let callHandlingCount = {
        answered: 0,
        unanswered: 0,
        emitted: 0
    };



    // WebSocket listener to receive queue list and call history
    Cti.receive = function (event) {
        const data = JSON.parse(event.data);
        console.log("Received message: ", data);
        if (data && data.msgType) {
            if (data.msgType === "QueueList") {
                const queueList = data.ctiMessage;
                // Populate the dropdown with queue names
                const queueSelect = document.getElementById("queueSelect");
                queueSelect.innerHTML = "";
                queueList.forEach(queue => {
                    const option = document.createElement("option");
                    option.value = queue.number;
                    option.textContent = `${queue.number} - ${queue.name}`;
                    queueSelect.appendChild(option);

                    // Initialize call count for each queue
                    queueCallCount[queue.number] = {
                        queueId: queue.id,
                        queueName: queue.name,
                        totalCalls: 0,
                        queueTalkTime: 0
                    };
                });
                console.log("Initialized queue call counts: ", queueCallCount);
            } else if (data.msgType === "AgentList") {
                const agentsList = data.ctiMessage;
                myAgentsList.push(agentsList);
                const totalAgentCount = agentsList.length;
                document.getElementById("agentCountDisplay").textContent = totalAgentCount;
                agentsList.forEach(agent => {
                    // Initialize agent array
                    agentCount[agent.number] = {
                        agentId: agent.id,
                        agentNumber: agent.number,
                    };
                });

            } else if (data.msgType === "CallHistory") {
                // const callHistory = data.ctiMessage;

                // if (Array.isArray(callHistory)) {
                //     const now = new Date();
                //     const todayAt7AM = new Date();
                //     todayAt7AM.setHours(7, 0, 0, 0);
                //     // functionality to check if call logs contains queue history only
                //     let allQueueCalls = true;
                //     callHistory.forEach(call => {
                //         const dstNum = call.dstNum;
                //         // Check if the dstNum exists in queueCallCount
                //         if (!queueCallCount.hasOwnProperty(dstNum)) {
                //             allQueueCalls = false;
                //         }
                //     });

                //     let longestqueueCall = 0;
                //     callHistory.forEach(call => {
                //         const dstNum = call.dstNum;
                //         const status = call.status;
                //         const queueDuration = durationToSeconds(call.duration);
                //         const callStartTime = new Date(call.start);

                //         // filter logs from today 7am
                //         if (callStartTime >= todayAt7AM && callStartTime <= now) {
                //             if (queueCallCount.hasOwnProperty(dstNum)) {
                //                 if (allQueueCalls) {
                //                     console.log(`Processing as Queue: ${dstNum}`);
                //                     if (status === "answered") {
                //                         callHandlingCount.answered++;
                //                     } else if (status === "abandoned") {
                //                         callHandlingCount.unanswered++;
                //                     } else if (status === "emitted") {
                //                         callHandlingCount.emitted++;
                //                     }
                //                     // Increment call count for the queue
                //                     queueCallCount[dstNum].totalCalls++;
                //                     queueCallCount[dstNum].queueTalkTime += durationToSeconds(call.duration);

                //                     if (queueDuration > longestqueueCall) {
                //                         longestqueueCall = queueDuration;
                //                         console.log("-------------------------------", queueDuration);
                //                     }

                //                     // Assign the call to the appropriate time frame
                //                     timeFrames.forEach(frame => {
                //                         if (callStartTime >= frame.start && callStartTime < frame.end) {
                //                             if (!hourlyCallData[frame.label][dstNum]) {
                //                                 hourlyCallData[frame.label][dstNum] = 0;
                //                             }
                //                             hourlyCallData[frame.label][dstNum]++;
                //                         }
                //                     });
                //                 }
                //             }
                //         }
                //     });

                //     // 
                //     document.getElementById("longestQueueCall").innerText = formatDuration(longestqueueCall);
                //     const labels = Object.values(queueCallCount).map(queue => queue.queueName);
                //     const values = Object.values(queueCallCount).map(queue => queue.totalCalls);
                //     // Calculate totals
                //     const totalCalls = values.reduce((acc, val) => acc + val, 0);
                //     const totalQueues = labels.length;
                //     const answerRate = (callHandlingCount.answered / totalCalls).toFixed(2);
                //     document.getElementById("answerRate").innerText = answerRate;
                //     document.getElementById("totalCalls").innerText = totalCalls;
                //     document.getElementById("totalQueues").innerText = totalQueues;
                //     document.getElementById("totalAnswered").innerText = callHandlingCount.answered;
                //     document.getElementById("totalUnanswered").innerText = callHandlingCount.unanswered;


                //     // Plot call distribution pie chart
                //     const layout = { title: "Call Distribution" };
                //     const data = [{
                //         labels: labels,
                //         values: values,
                //         type: "pie"
                //     }];
                //     Plotly.newPlot("myPlot", data, layout);


                //     // Prepare data for Call Handling pie chart
                //     const handlingLabels = ["Answered", "Unanswered", "Emitted"];
                //     const handlingValues = [callHandlingCount.answered, callHandlingCount.unanswered, callHandlingCount.emitted];
                //     const layout2 = { title: "Call Handling Distribution" };
                //     const data2 = [{
                //         labels: handlingLabels,
                //         values: handlingValues,
                //         type: "pie"
                //     }];
                //     Plotly.newPlot("myPlot2", data2, layout2);

                //     // 
                //     // const defaultQueue = Object.keys(queueCallCount)[0];
                //     const defaultQueue = parseInt(document.querySelector('#queueSelect option').textContent.split(' - ')[0], 10);
                //     console.log("hourly data", hourlyCallData, "default queue", defaultQueue, "timeframes", timeFrames.map(frame => frame.label));
                //     plotLineGraph(hourlyCallData, defaultQueue, timeFrames.map(frame => frame.label), 'myLineGraph');

                //     // Call function to process agents statistics in home Page
                //     let totalAgentsCount = parseInt(document.getElementById('agentCountDisplay').innerText, 10) || 0;
                //     processAgentStatistics(totalAgentsCount);
                // } else {
                //     console.error("Call history is not an array", callHistory);
                // }

                // Fetch only queue logs from the API


                const timeFrames = createTimeFrames(2);
                let hourlyCallData = initializeHourlyCallData(timeFrames);
                fetchData('queue_logs').then(queueLogs => {
                    console.log("=========================================", queueLogs);
                    const queueCallCount = {};
                    const callsInQueue = {}; // To track calls that entered the queue
                    const queueList = Object.keys(queueCallCount);
                    let overallLongestAnsweredCall = 0;
                    let callHandlingCount = {
                        answered: 0,
                        unanswered: 0
                    };

                    // Initialize queue counts
                    queueLogs.forEach(log => {
                        const queueName = log.queuename;
                        const callId = log.callid;
                        const event = log.event;
                        const callStartTime = new Date(log.time);
                        const callDuration = Number(log.data1);

                        // Ensure the queue is tracked
                        if (!queueCallCount[queueName]) {
                            queueCallCount[queueName] = {
                                totalCalls: 0,
                                answeredCalls: 0,
                                abandonedCalls: 0
                            };
                        }

                        // Track calls that enter the queue
                        if (event === "ENTERQUEUE") {
                            queueCallCount[queueName].totalCalls++;
                            callsInQueue[callId] = queueName; // Store the queue name for this call ID
                        }

                        // Track answered calls based on the call ID
                        if (event === "CONNECT") {
                            if (callsInQueue[callId]) { // Check if this call ID has entered a queue
                                queueCallCount[callsInQueue[callId]].answeredCalls++;
                                callHandlingCount.answered++;
                                delete callsInQueue[callId]; // Remove from the queue since it has been answered

                                // Track the longest answered call overall
                                if (callDuration > overallLongestAnsweredCall) {
                                    overallLongestAnsweredCall = callDuration;
                                }
                            }


                            // Assign the call to the appropriate time frame
                            timeFrames.forEach(frame => {
                                if (callStartTime >= frame.start && callStartTime < frame.end) {
                                    if (!hourlyCallData[frame.label][queueName]) {
                                        hourlyCallData[frame.label][queueName] = 0;
                                    }
                                    hourlyCallData[frame.label][queueName]++;
                                }
                            });
                        }

                        // Track abandoned calls
                        if (event === "ABANDON") {
                            if (callsInQueue[callId]) { // Check if this call ID has entered a queue
                                queueCallCount[callsInQueue[callId]].abandonedCalls++;
                                callHandlingCount.unanswered++;
                                delete callsInQueue[callId]; // Remove from the queue since it has been abandoned
                            }
                        }
                    });

                    // Log the results
                    console.log("Queue Call Counts:", queueCallCount);

                    // Optionally, update the UI or other elements with the totals
                    for (const queue in queueCallCount) {
                        console.log(`Queue: ${queue}, Total Calls: ${queueCallCount[queue].totalCalls}, Answered Calls: ${queueCallCount[queue].answeredCalls}, Abandoned Calls: ${queueCallCount[queue].abandonedCalls}`);
                    }

                    const totalAnsweredCalls = callHandlingCount.answered;
                    const enteredCalls = totalAnsweredCalls + callHandlingCount.unanswered;
                    const answerRate = enteredCalls > 0 ? (totalAnsweredCalls / enteredCalls) * 100 : 0;

                    document.getElementById("longestQueueCall").innerText = formatDuration(overallLongestAnsweredCall);
                    document.getElementById("answerRate").innerText = answerRate.toFixed();
                    document.getElementById("totalCalls").innerText = enteredCalls;
                    // document.getElementById("totalQueues").innerText = totalQueues;
                    document.getElementById("totalAnswered").innerText = callHandlingCount.answered;
                    document.getElementById("totalUnanswered").innerText = callHandlingCount.unanswered;

                    const labels = Object.keys(queueCallCount);
                    const values = Object.values(queueCallCount).map(queue => queue.totalCalls);

                    // Plot the first pie chart with call distribution
                    const layout = { title: "Call Distribution" };
                    const data = [{
                        labels: labels,
                        values: values,
                        type: "pie"
                    }];
                    Plotly.newPlot("myPlot", data, layout);
                    // Prepare data for the second pie chart (Call Handling)
                    const handlingLabels = ["Answered", "Unanswered", "Emitted"];
                    const handlingValues = [callHandlingCount.answered, callHandlingCount.unanswered, callHandlingCount.emitted];

                    // Plotting the second pie chart
                    const layout2 = { title: "Call Handling Distribution" };
                    const data2 = [{
                        labels: handlingLabels,
                        values: handlingValues,
                        type: "pie"
                    }];
                    Plotly.newPlot("myPlot2", data2, layout2);

                    // Get default drop down value and 
                    const defaultOption = document.querySelector('#queueSelect option'); // Get the selected option
                    const defaultQueue = defaultOption ? defaultOption.textContent.split(' - ')[1].trim() : '';
                    console.log("hourly data", hourlyCallData, "default queue", defaultQueue, "timeframes", timeFrames.map(frame => frame.label));
                    plotLineGraph(hourlyCallData, defaultQueue, timeFrames.map(frame => frame.label), 'myLineGraph');

                    // Event listener for queue selection change
                    document.getElementById("queueSelect").addEventListener("change", function () {
                        const selectedValue = this.value;
                        console.log("Selected value (queue number):", selectedValue);
                        const selectedOption = this.options[this.selectedIndex].text;
                        console.log("Selected option text:", selectedOption);
                        // Extract username from the selected option text
                        const parts = selectedOption.split(' - ');
                        const username = parts.length > 1 ? parts[1].trim() : '';
                        console.log("Extracted username:", username);
                        plotLineGraph(hourlyCallData, username, timeFrames.map(frame => frame.label), 'myLineGraph');
                    });

                }).catch(error => {
                    console.error("Error fetching queue logs: ", error);
                });


            }
        }
    };

}



// Updated plotLineGraph function to handle queue names and accurate time frames
function plotLineGraph(hourlyCallData, selectedQueue, timeFrames, graphId) {
    const queueData = timeFrames.map(frame => hourlyCallData[frame][selectedQueue] || 0);

    // Prepare line graph data
    const lineData = [{
        x: timeFrames,
        y: queueData,
        mode: 'lines+markers',
        name: `Queue ${selectedQueue}`
    }];

    // Updated layout to include the queue name in the title
    const lineLayout = {
        title: `Calls Over the Last 24 Hours for Queue ${selectedQueue}`,
        xaxis: { title: "Time (hours)", tickvals: timeFrames },
        yaxis: { title: "Number of Calls" }
    };

    // Plot the graph in the specified HTML element
    Plotly.newPlot(graphId, lineData, lineLayout);
}



// Create time frames for graph
function createTimeFrames(interval) {
    const now = new Date();
    const timeFrames = [];

    for (let i = interval; i <= 24; i += interval) {
        let start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), i - interval);
        let end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), i);
        timeFrames.push({
            start: start,
            end: end,
            label: `${i}`
        });
    }
    return timeFrames;
}

// Function to inititalize graph data
function initializeHourlyCallData(timeFrames) {
    const hourlyCallData = {};
    timeFrames.forEach(frame => {
        hourlyCallData[frame.label] = {};  // Initialize each label with an empty object
    });
    return hourlyCallData;
}

// Format duration to HH:MM:SS
function formatDuration(duration) {
    // Ensure the input is a number and non-negative
    if (typeof duration !== 'number' || duration < 0) {
        throw new Error('Duration must be a non-negative number');
    }
    const hours = String(Math.floor(duration / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((duration % 3600) / 60)).padStart(2, '0');
    const seconds = String(Math.floor(duration % 60)).padStart(2, '0'); // Floor seconds to remove decimals
    return `${hours}:${minutes}:${seconds}`;
}


// Function to convert duration in HH:MM:SS to seconds
function durationToSeconds(duration) {
    if (duration) {
        let parts = duration.split(':').map(Number);
        let converted = parts[0] * 3600 + parts[1] * 60 + parts[2];
        return converted;
    } else {
        console.log("no timestamp passed");
        return;
    }
}




// Function to process agents stats in index.html
async function processAgentStatistics(totalAgentsCount, agentsList) {
    const agentInboundTimeframes = createTimeFrames(2);
    let agentInboundHourlyInboundData = initializeHourlyCallData(agentInboundTimeframes);

    const agentOutboundTimeframes = createTimeFrames(2);
    let agentOutboundHourlyInboundData = initializeHourlyCallData(agentOutboundTimeframes);

    try {
        // Fetch all agent statistics
        const { agentStatistics, outboundStatistics, longestCallDuration, longestCallAgentId, agentUtilization } = await fetchAllAgentStatistics(totalAgentsCount);
        // Calculate total outbound calls
        let totalOutboundCalls = 0;
        Object.keys(outboundStatistics).forEach(outboundAgentId => {
            totalOutboundCalls += outboundStatistics[outboundAgentId].totalOutboundCalls || 0;
        });

        // Calculate total handle time and aggregate efficiency for inbound agents
        let totalHandleTimeAllAgents = 0;
        let totalInboundEfficiency = 0;
        const totalInboundAgents = Object.keys(agentStatistics).length;

        Object.keys(agentStatistics).forEach(inboundAgentId => {
            const stats = agentStatistics[inboundAgentId];
            if (stats.totalCalls > 0) {
                // Use pre-calculated handle time and efficiency
                totalHandleTimeAllAgents += parseFloat(stats.averageHandleTime);
                totalInboundEfficiency += parseFloat(stats.efficiency);

                // Loop through the inbound time logs for the agent
                stats.inboundTimeLogs.forEach(logDate => {
                    const callStartTime = new Date(logDate);
                    // Increment the hourly call data for the agent
                    agentInboundTimeframes.forEach(timeframe => {
                        if (callStartTime >= timeframe.start && callStartTime < timeframe.end) {
                            if (!agentInboundHourlyInboundData[timeframe.label][inboundAgentId]) {
                                agentInboundHourlyInboundData[timeframe.label][inboundAgentId] = 0;
                            }
                            agentInboundHourlyInboundData[timeframe.label][inboundAgentId]++;
                        }
                    });
                });
            }
        });

        // Calculate overall average efficiency and handle time for inbound agents
        const inboundAverageEfficiency = totalInboundAgents > 0 ? (totalInboundEfficiency / totalInboundAgents).toFixed(2) : '0.00';
        const overallAverageHandleTime = totalInboundAgents > 0 ? formatDuration(totalHandleTimeAllAgents / totalInboundAgents) : '00:00:00';
        // Calculate total handle time and aggregate efficiency for outbound agents
        let totalHandleTimeAllOutboundAgents = 0;
        let totalOutboundEfficiency = 0;
        const totalOutboundAgents = Object.keys(outboundStatistics).length;

        Object.keys(outboundStatistics).forEach(outboundAgentId => {
            const outboundStats = outboundStatistics[outboundAgentId];
            if (outboundStats.totalOutboundCalls > 0) {
                totalHandleTimeAllOutboundAgents += parseFloat(outboundStats.averageOutboundHandleTime);
                totalOutboundEfficiency += parseFloat(outboundStats.outboundEfficiency);
                // Loop through the outbound time logs for the agent
                outboundStats.outboundTimeLogs.forEach(logDate => {
                    // Parse the call start time
                    const callStartTime = new Date(logDate);
                    // Increment the hourly call data for the agent
                    agentOutboundTimeframes.forEach(timeframe => {
                        if (callStartTime >= timeframe.start && callStartTime < timeframe.end) {
                            if (!agentOutboundHourlyInboundData[timeframe.label][outboundAgentId]) {
                                agentOutboundHourlyInboundData[timeframe.label][outboundAgentId] = 0;
                            }
                            agentOutboundHourlyInboundData[timeframe.label][outboundAgentId]++;
                        }
                    });
                });
            }
        });

        // Calculate overall average efficiency for outbound agents
        const outboundAverageEfficiency = totalOutboundAgents > 0 ? (totalOutboundEfficiency / totalOutboundAgents).toFixed(2) : '0.00';

        // Update DOM with calculated values
        document.getElementById("agentEfficiency").innerText = inboundAverageEfficiency;
        document.getElementById("averageHandleTime").innerText = overallAverageHandleTime;
        document.getElementById("otboundEfficiency").innerText = outboundAverageEfficiency;
        document.getElementById("averageHandleTime").innerText = overallAverageHandleTime;
        document.getElementById("totalOutboundCalls").innerText = totalOutboundCalls;
        document.getElementById("agent-utilization").innerText = agentUtilization;

        // Plot Agent Inbound calls graph
        plotLineGraph(agentInboundHourlyInboundData, 5, agentInboundTimeframes.map(timeframe => timeframe.label), 'AgentGraph');
        // Event listener for queue selection change
        document.getElementById("searchButton").addEventListener("click", function () {
            const searchValue = document.getElementById("agentSearch").value;
            plotLineGraph(agentInboundHourlyInboundData, searchValue, agentInboundTimeframes.map(timeframe => timeframe.label), 'AgentGraph');
        });

        // Plot Agent Inbound calls graph
        plotLineGraph(agentOutboundHourlyInboundData, 5, agentOutboundTimeframes.map(timeframe => timeframe.label), 'AgentInboundGraph');
        // Event listener for queue selection change
        document.getElementById("InboundsearchButton").addEventListener("click", function () {
            const searchValue1 = document.getElementById("agentInboundSearch").value;
            plotLineGraph(agentOutboundHourlyInboundData, searchValue1, agentOutboundTimeframes.map(timeframe => timeframe.label), 'AgentInboundGraph');
        });

    } catch (error) {
        console.error("Error in processAgentStatistics:", error);
        throw error;
    }


}