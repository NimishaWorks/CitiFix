
document.addEventListener('DOMContentLoaded', () => {
    const issuesGrid = document.getElementById('issues-grid');
    const filterType = document.getElementById('filterType');
    const filterStatus = document.getElementById('filterStatus');

    let issues = [];

    async function fetchIssues() {
        try {
            const response = await fetch('http://localhost:5000/issues');
            issues = await response.json();
            renderIssues(issues);
        } catch (error) {
            console.error('Error fetching issues:', error);
            issuesGrid.innerHTML = '<p class="error-message">Failed to load issues. Please try again later.</p>';
        }
    }

    function renderIssues(issuesData) {
        issuesGrid.innerHTML = '';
        
        issuesData.forEach(issue => {
            const issueCard = document.createElement('div');
            issueCard.className = `issue-card ${issue.status.toLowerCase()}`;
            
            issueCard.innerHTML = `
                <div class="issue-header">
                    <h3>${issue.title}</h3>
                    <span class="status-badge ${issue.status.toLowerCase()}">${issue.status}</span>
                </div>
                <p class="issue-type"><i class="fas fa-tag"></i> ${issue.type}</p>
                <p class="issue-description">${issue.description}</p>
                ${issue.image ? `<img src="${issue.image}" alt="Issue image" class="issue-image"/>` : ''}
                <div class="issue-footer">
                    <span><i class="fas fa-calendar"></i> ${new Date(issue.date).toLocaleDateString()}</span>
                    <span><i class="fas fa-map-marker-alt"></i> View on Map</span>
                </div>
            `;
            
            issuesGrid.appendChild(issueCard);
        });
    }

    function filterIssues() {
        const typeFilter = filterType.value;
        const statusFilter = filterStatus.value;
        
        const filteredIssues = issues.filter(issue => {
            const matchesType = !typeFilter || issue.type === typeFilter;
            const matchesStatus = !statusFilter || issue.status === statusFilter;
            return matchesType && matchesStatus;
        });
        
        renderIssues(filteredIssues);
    }

    filterType.addEventListener('change', filterIssues);
    filterStatus.addEventListener('change', filterIssues);

    // Initial load
    fetchIssues();
});