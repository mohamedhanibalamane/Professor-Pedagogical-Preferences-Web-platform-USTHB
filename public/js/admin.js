// Vérifier si l'utilisateur est authentifié et a le rôle admin
document.addEventListener('DOMContentLoaded', function() {
    // Vérifier l'authentification
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    // Charger les informations de l'utilisateur
    fetch('/api/auth/me', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Non autorisé');
        }
        return response.json();
    })
    .then(data => {
        if (data.user.role !== 'admin' && data.user.role !== 'superadmin') {
            alert('Vous n\'avez pas les droits pour accéder à cette page');
            window.location.href = '/index.html';
            return;
        }
        
        // Afficher le nom de l'utilisateur
        document.getElementById('user-name').textContent = data.user.username;
        
        // Vérifier si l'utilisateur est superadmin pour afficher la section de gestion des utilisateurs
        if (data.user.role === 'superadmin') {
            document.getElementById('users-nav-item').style.display = 'block';
        }
        
        // Initialiser le tableau de bord
        initDashboard();
    })
    .catch(error => {
        console.error('Erreur:', error);
        localStorage.removeItem('token');
        window.location.href = '/login.html';
    });

    // Gestion de la déconnexion
    document.getElementById('logout-btn').addEventListener('click', function() {
        localStorage.removeItem('token');
        window.location.href = '/login.html';
    });

    // Navigation entre les sections
    const links = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.section');

    links.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Retirer la classe active de tous les liens
            links.forEach(l => l.classList.remove('active'));
            
            // Ajouter la classe active au lien cliqué
            this.classList.add('active');
            
            // Masquer toutes les sections
            sections.forEach(section => section.classList.add('d-none'));
            
            // Afficher la section correspondante
            const targetId = this.id.replace('-link', '-section');
            document.getElementById(targetId).classList.remove('d-none');
            
            // Charger les données spécifiques à la section
            if (targetId === 'modules-section') {
                loadModules();
            } else if (targetId === 'enseignants-section') {
                loadEnseignants();
            } else if (targetId === 'voeux-section') {
                loadVoeux();
            } else if (targetId === 'organigramme-section') {
                initOrganigramme();
            } else if (targetId === 'users-section') {
                loadUsers();
            }
        });
    });
});

// Initialisation du tableau de bord
function initDashboard() {
    const token = localStorage.getItem('token');
    
    // Charger les statistiques
    fetch('/api/admin/stats', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(data => {
        // Mettre à jour les compteurs
        document.getElementById('nb-enseignants').textContent = data.nbEnseignants;
        document.getElementById('nb-modules').textContent = data.nbModules;
        document.getElementById('nb-voeux').textContent = data.nbVoeux;
        
        // Initialiser les graphiques
        initModuleChart(data.moduleStats);
        initGradeChart(data.gradeStats);
    })
    .catch(error => console.error('Erreur:', error));
}

// Graphique de répartition par module
function initModuleChart(data) {
    const ctx = document.getElementById('moduleChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(item => item.module),
            datasets: [{
                label: 'Nombre d\'enseignants',
                data: data.map(item => item.count),
                backgroundColor: 'rgba(54, 162, 235, 0.7)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

// Graphique de répartition par grade
function initGradeChart(data) {
    const ctx = document.getElementById('gradeChart').getContext('2d');
    new Chart(ctx, {
        type: 'pie',
        data: {
            labels: data.map(item => item.grade),
            datasets: [{
                label: 'Nombre d\'enseignants',
                data: data.map(item => item.count),
                backgroundColor: [
                    'rgba(255, 99, 132, 0.7)',
                    'rgba(54, 162, 235, 0.7)',
                    'rgba(255, 206, 86, 0.7)',
                    'rgba(75, 192, 192, 0.7)'
                ],
                borderColor: [
                    'rgba(255, 99, 132, 1)',
                    'rgba(54, 162, 235, 1)',
                    'rgba(255, 206, 86, 1)',
                    'rgba(75, 192, 192, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true
        }
    });
}

// Chargement des modules
function loadModules() {
    const token = localStorage.getItem('token');
    
    // Charger les spécialités pour le filtre
    fetch('/api/specialites', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(data => {
        const selectSpecialite = document.getElementById('filter-specialite');
        selectSpecialite.innerHTML = '<option value="">Toutes les spécialités</option>';
        
        data.forEach(specialite => {
            const option = document.createElement('option');
            option.value = specialite._id;
            option.textContent = specialite.nom;
            selectSpecialite.appendChild(option);
        });
    })
    .catch(error => console.error('Erreur:', error));
    
    // Charger les modules
    fetch('/api/admin/modules', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(data => {
        const modulesTable = document.getElementById('modules-table');
        modulesTable.innerHTML = '';
        
        data.forEach(module => {
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${module.nom}</td>
                <td>${module.specialite ? module.specialite.nom : 'Non spécifié'}</td>
                <td>Semestre ${module.semestre}</td>
                <td>${module.nature ? module.nature.join(', ') : '-'}</td>
                <td>${module.nbEnseignants || 0}</td>
                <td>
                    <button class="btn btn-sm btn-primary voir-enseignants" data-id="${module._id}">
                        <i class="bi bi-people me-1"></i>Voir enseignants
                    </button>
                </td>
            `;
            
            modulesTable.appendChild(row);
        });
        
        // Ajouter les écouteurs d'événements
        document.querySelectorAll('.voir-enseignants').forEach(btn => {
            btn.addEventListener('click', function() {
                const moduleId = this.getAttribute('data-id');
                showEnseignantsForModule(moduleId);
            });
        });
    })
    .catch(error => console.error('Erreur:', error));
    
    // Écouteurs pour les filtres
    document.getElementById('filter-specialite').addEventListener('change', filterModules);
    document.getElementById('filter-semestre').addEventListener('change', filterModules);
    document.getElementById('filter-nature').addEventListener('change', filterModules);
    document.getElementById('filter-module-enseignants').addEventListener('change', filterModules);
    document.getElementById('search-module').addEventListener('input', filterModules);
    document.getElementById('reset-modules-filter').addEventListener('click', function() {
        resetModulesFilters();
    });
}

// Filtrer les modules
function filterModules() {
    const specialite = document.getElementById('filter-specialite').value;
    const semestre = document.getElementById('filter-semestre').value;
    const nature = document.getElementById('filter-nature').value;
    const enseignants = document.getElementById('filter-module-enseignants').value;
    const search = document.getElementById('search-module').value.toLowerCase();
    
    // Mettre à jour les filtres actifs
    document.getElementById('modules-active-filters').innerHTML = '';
    
    if (specialite) {
        const specialiteText = document.getElementById('filter-specialite').options[document.getElementById('filter-specialite').selectedIndex].text;
        addActiveFilter('modules-active-filters', 'specialite', specialite, `Spécialité: ${specialiteText}`);
    }
    
    if (semestre) {
        addActiveFilter('modules-active-filters', 'semestre', semestre, `Semestre: ${semestre}`);
    }
    
    if (nature) {
        addActiveFilter('modules-active-filters', 'nature', nature, `Nature: ${nature}`);
    }
    
    if (enseignants) {
        const displayText = enseignants === 'avec' ? 'Avec enseignants' : 'Sans enseignants';
        addActiveFilter('modules-active-filters', 'module-enseignants', enseignants, displayText);
    }
    
    if (search) {
        addActiveFilter('modules-active-filters', 'search', search, `Recherche: "${search}"`);
    }
    
    // Filtrer le tableau
    const rows = document.getElementById('modules-table').getElementsByTagName('tr');
    
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const moduleNom = row.cells[0].textContent.toLowerCase();
        const moduleSpecialite = row.cells[1].textContent;
        const moduleSemestre = row.cells[2].textContent;
        const moduleNature = row.cells[3].textContent;
        const moduleEnseignants = parseInt(row.cells[4].textContent.trim(), 10);
        
        let specialiteMatch = true;
        let semestreMatch = true;
        let natureMatch = true;
        let enseignantsMatch = true;
        let searchMatch = true;
        
        // Filtre par spécialité
        if (specialite && !moduleSpecialite.includes(document.getElementById('filter-specialite').options[document.getElementById('filter-specialite').selectedIndex].text)) {
            specialiteMatch = false;
        }
        
        // Filtre par semestre
        if (semestre && !moduleSemestre.includes(`Semestre ${semestre}`)) {
            semestreMatch = false;
        }
        
        // Filtre par nature
        if (nature && !moduleNature.includes(nature)) {
            natureMatch = false;
        }
        
        // Filtre par nombre d'enseignants
        if (enseignants) {
            if (enseignants === 'avec' && moduleEnseignants <= 0) {
                enseignantsMatch = false;
            } else if (enseignants === 'sans' && moduleEnseignants > 0) {
                enseignantsMatch = false;
            }
        }
        
        // Filtre par recherche
        if (search && !moduleNom.includes(search)) {
            searchMatch = false;
        }
        
        // Afficher ou masquer la ligne
        if (specialiteMatch && semestreMatch && natureMatch && enseignantsMatch && searchMatch) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    }
    
    // Mettre à jour le compteur de résultats
    updateFilterResultsCount('modules-table', 'modules-active-filters');
}

// Afficher les enseignants pour un module
function showEnseignantsForModule(moduleId) {
    const token = localStorage.getItem('token');
    
    fetch(`/api/admin/modules/${moduleId}/enseignants`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(data => {
        // Récupérer le nom du module
        fetch(`/api/modules/${moduleId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => response.json())
        .then(moduleData => {
            // Créer et afficher une fenêtre modale
            let modalContent = `
                <div class="modal fade" id="moduleEnseignantsModal" tabindex="-1" aria-hidden="true">
                    <div class="modal-dialog modal-lg modal-dialog-centered">
                        <div class="modal-content border-0 shadow">
                            <div class="modal-header bg-primary text-white">
                                <h5 class="modal-title">
                                    <i class="bi bi-people-fill me-2"></i>
                                    Enseignants pour le module: ${moduleData.nom}
                                </h5>
                                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Fermer"></button>
                            </div>
                            <div class="modal-body px-4 py-4">
                                <div class="d-flex justify-content-between align-items-center mb-4">
                                    <span class="badge bg-info text-white py-2 px-3 rounded-pill">
                                        <i class="bi bi-mortarboard-fill me-1"></i>
                                        ${moduleData.specialite ? moduleData.specialite.nom : 'Non spécifié'} - Semestre ${moduleData.semestre}
                                    </span>
                                    <span class="badge bg-secondary py-2 px-3 rounded-pill">
                                        <i class="bi bi-people-fill me-1"></i>
                                        ${data.length} enseignant(s)
                                    </span>
                                </div>
                                <div class="table-container">
                                    <table class="table table-striped table-hover align-middle">
                                        <thead class="table-light">
                                            <tr>
                                                <th class="border-0">
                                                    <div class="d-flex align-items-center">
                                                        <i class="bi bi-person-fill me-2 text-primary"></i>Nom
                                                    </div>
                                                </th>
                                                <th class="border-0">
                                                    <div class="d-flex align-items-center">
                                                        <i class="bi bi-envelope-fill me-2 text-primary"></i>Email
                                                    </div>
                                                </th>
                                                <th class="border-0">
                                                    <div class="d-flex align-items-center">
                                                        <i class="bi bi-telephone-fill me-2 text-primary"></i>Téléphone
                                                    </div>
                                                </th>
                                                <th class="border-0">
                                                    <div class="d-flex align-items-center">
                                                        <i class="bi bi-mortarboard-fill me-2 text-primary"></i>Grade
                                                    </div>
                                                </th>
                                                <th class="border-0">
                                                    <div class="d-flex align-items-center">
                                                        <i class="bi bi-book-fill me-2 text-primary"></i>Nature
                                                    </div>
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
            `;
            
            if (data.length === 0) {
                modalContent += `
                    <tr class="fade-in-row">
                        <td colspan="5" class="text-center py-5">
                            <div class="d-flex flex-column align-items-center">
                                <i class="bi bi-emoji-frown text-muted" style="font-size: 2.5rem;"></i>
                                <p class="mt-3 mb-0 text-muted">Aucun enseignant n'a choisi ce module</p>
                            </div>
                        </td>
                    </tr>
                `;
            } else {
                data.forEach((enseignant, index) => {
                    // Obtenir la nature correctement et l'afficher
                    let natureDisplay = '';
                    if (enseignant.nature && Array.isArray(enseignant.nature) && enseignant.nature.length > 0) {
                        natureDisplay = enseignant.nature.map(n => {
                            const badgeClass = n === 'Cours' ? 'bg-success' : 
                                            n === 'TD' ? 'bg-info' : 
                                            n === 'TP' ? 'bg-warning' : 'bg-secondary';
                            return `<span class="badge ${badgeClass} me-1">${n}</span>`;
                        }).join(' ');
                    } else {
                        natureDisplay = '<span class="badge bg-secondary">Non spécifié</span>';
                    }
                    
                    modalContent += `
                        <tr class="fade-in-row" style="animation-delay: ${index * 0.1}s">
                            <td>
                                <div class="d-flex align-items-center">
                                    <div class="avatar-circle bg-light text-primary me-2 d-flex align-items-center justify-content-center" style="width: 35px; height: 35px; border-radius: 50%;">
                                        <i class="bi bi-person-fill"></i>
                                    </div>
                                    <div>${enseignant.nom || 'Non spécifié'}</div>
                                </div>
                            </td>
                            <td>${enseignant.email || 'Non spécifié'}</td>
                            <td>${enseignant.telephone || 'Non spécifié'}</td>
                            <td>
                                <span class="fw-medium">${enseignant.grade || 'Non spécifié'}</span>
                            </td>
                            <td>${natureDisplay}</td>
                        </tr>
                    `;
                });
            }
            
            modalContent += `
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div class="modal-footer border-0">
                                <button type="button" class="btn btn-outline-primary" data-bs-dismiss="modal">
                                    <i class="bi bi-x-circle me-2"></i>Fermer
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <style>
                    .fade-in-row {
                        opacity: 0;
                        transform: translateY(20px);
                        animation: fadeInUp 0.5s ease forwards;
                    }
                    
                    @keyframes fadeInUp {
                        to {
                            opacity: 1;
                            transform: translateY(0);
                        }
                    }
                    
                    #moduleEnseignantsModal .modal-content {
                        border-radius: 12px;
                        overflow: hidden;
                    }
                    
                    #moduleEnseignantsModal .modal-header {
                        padding: 1.2rem 1.5rem;
                    }
                    
                    #moduleEnseignantsModal .table {
                        border-collapse: separate;
                        border-spacing: 0 8px;
                        margin-top: -8px;
                    }
                    
                    #moduleEnseignantsModal .table tr {
                        box-shadow: 0 2px 5px rgba(0,0,0,0.05);
                        border-radius: 8px;
                        transition: transform 0.2s ease;
                    }
                    
                    #moduleEnseignantsModal .table tbody tr:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 5px 15px rgba(0,0,0,0.1);
                    }
                    
                    #moduleEnseignantsModal .table td {
                        padding: 12px 15px;
                        border: none;
                        background: white;
                    }
                    
                    #moduleEnseignantsModal .table td:first-child {
                        border-top-left-radius: 8px;
                        border-bottom-left-radius: 8px;
                    }
                    
                    #moduleEnseignantsModal .table td:last-child {
                        border-top-right-radius: 8px;
                        border-bottom-right-radius: 8px;
                    }
                    
                    #moduleEnseignantsModal .badge {
                        font-weight: 500;
                        padding: 0.4rem 0.8rem;
                    }
                    
                    #moduleEnseignantsModal .modal-backdrop {
                        backdrop-filter: blur(5px);
                    }
                    
                    .avatar-circle {
                        transition: all 0.3s ease;
                    }
                    
                    tr:hover .avatar-circle {
                        transform: scale(1.1);
                        box-shadow: 0 3px 8px rgba(0,0,0,0.15);
                    }
                </style>
            `;
            
            // Supprimer toute modale existante
            const existingModal = document.getElementById('moduleEnseignantsModal');
            if (existingModal) {
                existingModal.remove();
            }
            
            // Ajouter la modale au DOM
            document.body.insertAdjacentHTML('beforeend', modalContent);
            
            // Afficher la modale avec animation
            const modalElement = document.getElementById('moduleEnseignantsModal');
            const modal = new bootstrap.Modal(modalElement);
            
            // Ajouter les effets d'animation quand la modale s'ouvre
            modalElement.addEventListener('shown.bs.modal', function () {
                const rows = modalElement.querySelectorAll('.fade-in-row');
                rows.forEach((row, index) => {
                    row.style.animationDelay = `${0.1 + (index * 0.05)}s`;
                });
            });
            
            modal.show();
            
            // Ajouter un effet de flou sur le fond quand la modale est ouverte
            modalElement.addEventListener('shown.bs.modal', function() {
                document.querySelector('.modal-backdrop').style.backdropFilter = 'blur(5px)';
            });
        })
        .catch(error => console.error('Erreur lors de la récupération des détails du module:', error));
    })
    .catch(error => console.error('Erreur lors de la récupération des enseignants:', error));
}

// Chargement des enseignants
function loadEnseignants() {
    const token = localStorage.getItem('token');
    
    // Charger les départements pour le filtre
    fetch('/api/departements', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(data => {
        const selectDepartement = document.getElementById('filter-departement');
        selectDepartement.innerHTML = '<option value="">Tous les départements</option>';
        
        data.forEach(departement => {
            const option = document.createElement('option');
            option.value = departement._id;
            option.textContent = departement.Name;
            selectDepartement.appendChild(option);
        });
    })
    .catch(error => console.error('Erreur lors du chargement des départements:', error));
    
    fetch('/api/admin/enseignants', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(data => {
        const enseignantsTable = document.getElementById('enseignants-table');
        enseignantsTable.innerHTML = '';
        
        data.forEach(enseignant => {
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${enseignant.nom || 'Non spécifié'}</td>
                <td>${enseignant.email || 'Non spécifié'}</td>
                <td>${enseignant.telephone || 'Non spécifié'}</td>
                <td>${enseignant.grade || 'Non spécifié'}</td>
                <td>${enseignant.bureau || 'Non spécifié'}</td>
            `;
            
            enseignantsTable.appendChild(row);
        });
    })
    .catch(error => console.error('Erreur:', error));
    
    // Écouteurs pour les filtres
    document.getElementById('filter-grade').addEventListener('change', filterEnseignants);
    document.getElementById('filter-departement').addEventListener('change', filterEnseignants);
    document.getElementById('filter-enseignant-statut').addEventListener('change', filterEnseignants);
    document.getElementById('search-enseignant').addEventListener('input', filterEnseignants);
    document.getElementById('reset-enseignants-filter').addEventListener('click', function() {
        resetEnseignantsFilters();
    });
}

// Filtrer les enseignants
function filterEnseignants() {
    const grade = document.getElementById('filter-grade').value;
    const departement = document.getElementById('filter-departement').value;
    const statut = document.getElementById('filter-enseignant-statut').value;
    const search = document.getElementById('search-enseignant').value.toLowerCase();
    
    // Mettre à jour les filtres actifs
    document.getElementById('enseignants-active-filters').innerHTML = '';
    
    if (grade) {
        addActiveFilter('enseignants-active-filters', 'grade', grade, `Grade: ${grade}`);
    }
    
    if (departement) {
        const departementText = document.getElementById('filter-departement').options[document.getElementById('filter-departement').selectedIndex].text;
        addActiveFilter('enseignants-active-filters', 'departement', departement, `Département: ${departementText}`);
    }
    
    if (statut) {
        const displayText = statut === 'avec' ? 'Avec vœux' : 'Sans vœux';
        addActiveFilter('enseignants-active-filters', 'enseignant-statut', statut, displayText);
    }
    
    if (search) {
        addActiveFilter('enseignants-active-filters', 'search', search, `Recherche: "${search}"`);
    }
    
    // Filtrer le tableau
    const rows = document.getElementById('enseignants-table').getElementsByTagName('tr');
    
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const enseignantNom = row.cells[0].textContent.toLowerCase();
        const enseignantEmail = row.cells[1].textContent.toLowerCase();
        const enseignantTelephone = row.cells[2].textContent.toLowerCase();
        const enseignantGrade = row.cells[3].textContent;
        
        let gradeMatch = true;
        let departementMatch = true;
        let statutMatch = true;
        let searchMatch = true;
        
        // Filtre par grade
        if (grade && enseignantGrade !== grade) {
            gradeMatch = false;
        }
        
        // Filtre par département (à implémenter)
        
        // Filtre par statut (à implémenter - nécessite de savoir si l'enseignant a des vœux)
        
        // Filtre par recherche
        if (search && !enseignantNom.includes(search) && !enseignantEmail.includes(search) && !enseignantTelephone.includes(search)) {
            searchMatch = false;
        }
        
        // Afficher ou masquer la ligne
        if (gradeMatch && departementMatch && statutMatch && searchMatch) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    }
    
    // Mettre à jour le compteur de résultats
    updateFilterResultsCount('enseignants-table', 'enseignants-active-filters');
}

// Afficher les vœux pour un enseignant
function showVoeuxForEnseignant(enseignantId) {
    // Rediriger vers l'onglet des vœux et filtrer
    document.getElementById('voeux-link').click();
    
    // TODO: Implémenter le filtre pour afficher uniquement les vœux de cet enseignant
}

// Chargement des vœux
function loadVoeux() {
    const token = localStorage.getItem('token');
    let modulesMap = {}; // Pour stocker la correspondance ID -> nom du module
    
    // Charger les années disponibles
    fetch('/api/voeux/data/annees', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(data => {
        const selectAnnee = document.getElementById('filter-annee');
        selectAnnee.innerHTML = '<option value="">Toutes les années</option>';
        
        if (Array.isArray(data)) {
            data.forEach(annee => {
                const option = document.createElement('option');
                option.value = annee;
                option.textContent = annee;
                selectAnnee.appendChild(option);
            });
        }
    })
    .catch(error => console.error('Erreur:', error));
    
    // Première étape: charger tous les modules pour avoir la correspondance ID -> nom
    fetch('/api/modules', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(modulesData => {
        // Créer une map des ID de modules vers leurs noms
        if (Array.isArray(modulesData)) {
            modulesData.forEach(module => {
                if (module._id && module.nom) {
                    modulesMap[module._id] = module.nom;
                }
            });
        }
        
        // Deuxième étape: charger les vœux et utiliser la map des modules
        return fetch('/api/voeux', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
        });
    })
    .then(response => response.json())
    .then(data => {
        const voeuxTable = document.getElementById('voeux-table');
        voeuxTable.innerHTML = '';
        
        if (data.voeux && Array.isArray(data.voeux)) {
            data.voeux.forEach(voeu => {
            const row = document.createElement('tr');
            
            // Ajouter l'attribut data-annee à la ligne
            if (voeu.annee) {
                row.setAttribute('data-annee', voeu.annee);
            }
            
            // Format pour les modules
            let modulesS1 = '-';
            if (voeu.choix_s1 && Array.isArray(voeu.choix_s1) && voeu.choix_s1.length > 0) {
                    const modulesS1Items = voeu.choix_s1
                    .filter(choix => choix && choix.module)
                        .map(choix => {
                            let moduleName = '';
                            if (typeof choix.module === 'object' && choix.module.nom) {
                                moduleName = choix.module.nom;
                            } else if (typeof choix.module === 'string') {
                                // Utiliser la map pour obtenir le nom du module depuis son ID
                                moduleName = modulesMap[choix.module] || choix.module;
                            } else {
                                moduleName = 'Module inconnu';
                            }
                            
                            // Vérifier l'expérience
                            let hasExperience = false;
                            if (voeu.modules_precedents_s1 && Array.isArray(voeu.modules_precedents_s1)) {
                                hasExperience = voeu.modules_precedents_s1.some(historyItem => 
                                    historyItem.modules && historyItem.modules.some(m => 
                                        m.nom && m.nom.toLowerCase() === moduleName.toLowerCase()
                                    )
                                );
                            }
                            
                            // Ajouter un indicateur d'expérience
                            return hasExperience 
                                ? `<div>${moduleName} <i class="bi bi-check-circle-fill text-success" title="Expérience"></i></div>` 
                                : `<div>${moduleName}</div>`;
                        })
                        .join('');
                    
                    modulesS1 = modulesS1Items;
            }
            
            let modulesS2 = '-';
            if (voeu.choix_s2 && Array.isArray(voeu.choix_s2) && voeu.choix_s2.length > 0) {
                    const modulesS2Items = voeu.choix_s2
                    .filter(choix => choix && choix.module)
                        .map(choix => {
                            let moduleName = '';
                            if (typeof choix.module === 'object' && choix.module.nom) {
                                moduleName = choix.module.nom;
                            } else if (typeof choix.module === 'string') {
                                // Utiliser la map pour obtenir le nom du module depuis son ID
                                moduleName = modulesMap[choix.module] || choix.module;
                            } else {
                                moduleName = 'Module inconnu';
                            }
                            
                            // Vérifier l'expérience
                            let hasExperience = false;
                            if (voeu.modules_precedents_s2 && Array.isArray(voeu.modules_precedents_s2)) {
                                hasExperience = voeu.modules_precedents_s2.some(historyItem => 
                                    historyItem.modules && historyItem.modules.some(m => 
                                        m.nom && m.nom.toLowerCase() === moduleName.toLowerCase()
                                    )
                                );
                            }
                            
                            // Ajouter un indicateur d'expérience
                            return hasExperience 
                                ? `<div>${moduleName} <i class="bi bi-check-circle-fill text-success" title="Expérience"></i></div>` 
                                : `<div>${moduleName}</div>`;
                        })
                        .join('');
                    
                    modulesS2 = modulesS2Items;
            }
            
            // Couleur selon le statut
            let statusClass = '';
            if (voeu.statut === 'approuve') {
                statusClass = 'text-success';
            } else if (voeu.statut === 'refuse') {
                statusClass = 'text-danger';
            } else {
                statusClass = 'text-warning';
            }
            
            // Formater le statut
            let statut = '';
            if (voeu.statut === 'en_attente') {
                statut = 'En attente';
            } else if (voeu.statut === 'approuve') {
                statut = 'Approuvé';
            } else if (voeu.statut === 'refuse') {
                statut = 'Refusé';
            }
            
            row.innerHTML = `
                <td>${voeu.nom || 'Non spécifié'}</td>
                <td>${voeu.grade || 'Non spécifié'}</td>
                    <td>${modulesS1}</td>
                    <td>${modulesS2}</td>
                <td>
                    <span class="badge rounded-pill ${getHeuresSuppStyle(voeu.heures_supp_s1)}">
                        ${parseFloat(voeu.heures_supp_s1).toFixed(1).replace('.0', '')} h
                    </span>
                </td>
                <td class="${statusClass}">${statut || 'Non spécifié'}</td>
                <td>
                    <button class="btn btn-sm btn-info voir-detail" data-id="${voeu._id}">
                        <i class="bi bi-eye me-1"></i>Détail
                    </button>
                </td>
            `;
            
            voeuxTable.appendChild(row);
        });
            
            // Initialiser les tooltips
            const tooltips = document.querySelectorAll('[title]');
            tooltips.forEach(tooltip => {
                new bootstrap.Tooltip(tooltip);
            });
        
        // Ajouter les écouteurs d'événements
        document.querySelectorAll('.voir-detail').forEach(btn => {
            btn.addEventListener('click', function() {
                const voeuId = this.getAttribute('data-id');
                showVoeuDetail(voeuId);
            });
        });
        } else {
            voeuxTable.innerHTML = '<tr><td colspan="7" class="text-center">Aucun vœu trouvé</td></tr>';
        }
    })
    .catch(error => console.error('Erreur:', error));
    
    // Écouteurs pour les filtres
    document.getElementById('filter-annee').addEventListener('change', filterVoeux);
    document.getElementById('filter-statut').addEventListener('change', filterVoeux);
    document.getElementById('filter-voeux-grade').addEventListener('change', filterVoeux);
    document.getElementById('filter-heures-supp').addEventListener('change', filterVoeux);
    document.getElementById('search-voeu').addEventListener('input', filterVoeux);
    document.getElementById('reset-voeux-filter').addEventListener('click', function() {
        resetVoeuxFilters();
    });
}

// Filtrer les vœux
function filterVoeux() {
    const annee = document.getElementById('filter-annee').value;
    const statut = document.getElementById('filter-statut').value;
    const grade = document.getElementById('filter-voeux-grade').value;
    const heuresSupp = document.getElementById('filter-heures-supp').value;
    const search = document.getElementById('search-voeu').value.toLowerCase();
    
    // Mettre à jour les filtres actifs
    document.getElementById('voeux-active-filters').innerHTML = '';
    
    if (annee) {
        addActiveFilter('voeux-active-filters', 'annee', annee, `Année: ${annee}`);
    }
    
    if (statut) {
        let statutDisplay = statut;
        if (statut === 'approuve') statutDisplay = 'Approuvé';
        if (statut === 'refuse') statutDisplay = 'Refusé';
        if (statut === 'en_attente') statutDisplay = 'En attente';
        
        addActiveFilter('voeux-active-filters', 'statut', statut, `Statut: ${statutDisplay}`);
    }
    
    if (grade) {
        addActiveFilter('voeux-active-filters', 'voeux-grade', grade, `Grade: ${grade}`);
    }
    
    if (heuresSupp) {
        addActiveFilter('voeux-active-filters', 'heures-supp', heuresSupp, `Heures suppl.: ${heuresSupp} h`);
    }
    
    if (search) {
        addActiveFilter('voeux-active-filters', 'search', search, `Recherche: "${search}"`);
    }
    
    // Filtrer le tableau
    const rows = document.getElementById('voeux-table').getElementsByTagName('tr');
    
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (row.cells.length < 2) continue; // Ignorer les lignes sans cellules (comme "Aucun vœu trouvé")
        
        const enseignantNom = row.cells[0].textContent.toLowerCase();
        const enseignantGrade = row.cells[1].textContent;
        const enseignantStatut = row.cells[5].textContent.toLowerCase();
        const enseignantModulesS1 = row.cells[2].textContent.toLowerCase();
        const enseignantModulesS2 = row.cells[3].textContent.toLowerCase();
        const enseignantHeuresSupp = row.cells[4].textContent.trim();
        
        // Pour le filtre d'année, vérifions si le badge d'année est affiché dans la ligne ou près du tableau
        let anneeVisible = false;
        
        // On vérifie d'abord si le voeu a l'année indiquée dans un attribut data
        if (row.getAttribute('data-annee') === annee) {
            anneeVisible = true;
        } 
        // Si pas d'attribut data, on vérifie dans le texte affiché dans le tableau ou sur la page
        else if (annee && document.getElementById('voeux-section').textContent.includes(annee)) {
            anneeVisible = true;
        }
        
        let anneeMatch = !annee || anneeVisible;
        let statutMatch = true;
        let gradeMatch = true;
        let heuresSuppMatch = true;
        let searchMatch = true;
        
        // Filtre par statut
        if (statut) {
            if (statut === 'approuve' && !enseignantStatut.includes('approuvé')) {
                statutMatch = false;
            } else if (statut === 'refuse' && !enseignantStatut.includes('refusé')) {
                statutMatch = false;
            } else if (statut === 'en_attente' && !enseignantStatut.includes('en attente')) {
                statutMatch = false;
            }
        }
        
        // Filtre par grade
        if (grade && enseignantGrade !== grade) {
            gradeMatch = false;
        }
        
        // Filtre par heures supplémentaires
        if (heuresSupp) {
            // Extraire la valeur numérique des heures supplémentaires
            const heuresSuppValue = parseFloat(enseignantHeuresSupp.match(/\d+(\.\d+)?/g)[0]);
            if (parseFloat(heuresSupp) !== heuresSuppValue) {
                heuresSuppMatch = false;
            }
        }
        
        // Filtre par recherche
        if (search && !enseignantNom.includes(search) && !enseignantModulesS1.includes(search) && !enseignantModulesS2.includes(search)) {
            searchMatch = false;
        }
        
        // Afficher ou masquer la ligne
        if (anneeMatch && statutMatch && gradeMatch && heuresSuppMatch && searchMatch) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    }
    
    // Mettre à jour le compteur de résultats
    updateFilterResultsCount('voeux-table', 'voeux-active-filters');
}

// Afficher le détail d'un vœu
function showVoeuDetail(voeuId) {
    const token = localStorage.getItem('token');
    
    fetch(`/api/voeux/${voeuId}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(data => {
        const voeu = data.voeu;
        if (!voeu) {
            throw new Error('Données de vœu non disponibles');
        }
        
        const modal = new bootstrap.Modal(document.getElementById('voeuDetailModal'));
        const content = document.getElementById('voeu-detail-content');
        
        // Formater le statut avec badge coloré
        let statutBadge = '';
        if (voeu.statut === 'en_attente') {
            statutBadge = '<span class="badge bg-warning">En attente</span>';
        } else if (voeu.statut === 'approuve') {
            statutBadge = '<span class="badge bg-success">Approuvé</span>';
        } else if (voeu.statut === 'refuse') {
            statutBadge = '<span class="badge bg-danger">Refusé</span>';
        }
        
        // Formater le contenu du modal pour les choix du semestre 1
        let choixS1Html = '<div class="alert alert-info">Aucun choix pour ce semestre</div>';
        if (voeu.choix_s1 && Array.isArray(voeu.choix_s1) && voeu.choix_s1.length > 0) {
            const choixItems = [];
            
            for (const choix of voeu.choix_s1) {
                    let moduleName = 'Module inconnu';
                let specialiteName = 'Spécialité inconnue';
                
                if (choix.module) {
                    if (typeof choix.module === 'object' && choix.module.nom) {
                        moduleName = choix.module.nom;
                    } else if (typeof choix.module === 'string') {
                        // Utiliser la map pour obtenir le nom du module depuis son ID
                        moduleName = modulesMap[choix.module] || choix.module;
                    }
                    }
                    
                    if (choix.specialite) {
                    if (typeof choix.specialite === 'object' && choix.specialite.nom) {
                            specialiteName = choix.specialite.nom;
                    } else if (typeof choix.specialite === 'string') {
                        specialiteName = choix.specialite;
                    }
                }
                
                // Vérifier si l'enseignant a de l'expérience avec ce module
                let experienceIndicator = '';
                if (voeu.modules_precedents_s1 && Array.isArray(voeu.modules_precedents_s1)) {
                    const moduleTeache = voeu.modules_precedents_s1.some(historyItem => 
                        historyItem.modules && historyItem.modules.some(m => 
                            m.nom && m.nom.toLowerCase() === moduleName.toLowerCase()
                        )
                    );
                    
                    if (moduleTeache) {
                        experienceIndicator = '<span class="badge bg-success ms-2" data-bs-toggle="tooltip" title="Déjà enseigné">Expérience <i class="bi bi-check-circle"></i></span>';
                    }
                }
                
                // Format des modules avec badges pour les types d'enseignement
                const natures = Array.isArray(choix.nature) ? choix.nature : [];
                const natureBadges = natures.map(nat => {
                    let badgeClass = 'bg-secondary';
                    if (nat.toLowerCase().includes('cours')) badgeClass = 'bg-primary';
                    if (nat.toLowerCase().includes('td')) badgeClass = 'bg-info';
                    if (nat.toLowerCase().includes('tp')) badgeClass = 'bg-success';
                    return `<span class="badge ${badgeClass} me-1">${nat}</span>`;
                }).join('');
                    
                    choixItems.push(`
                    <div class="card mb-2 border-0 shadow-sm">
                        <div class="card-body">
                            <h6 class="card-title text-primary d-flex align-items-center">
                                ${moduleName}${experienceIndicator}
                            </h6>
                            <div class="d-flex justify-content-between align-items-center">
                                <span class="text-muted"><i class="bi bi-bookmark me-1"></i>${specialiteName}</span>
                                <div>${natureBadges || '<span class="badge bg-secondary">Non spécifié</span>'}</div>
                            </div>
                        </div>
                    </div>
                `);
            }
            
            if (choixItems.length > 0) {
                choixS1Html = choixItems.join('');
            }
        }
        
        // Formater le contenu du modal pour les choix du semestre 2
        let choixS2Html = '<div class="alert alert-info">Aucun choix pour ce semestre</div>';
        if (voeu.choix_s2 && Array.isArray(voeu.choix_s2) && voeu.choix_s2.length > 0) {
            const choixItems = [];
            
            for (const choix of voeu.choix_s2) {
                    let moduleName = 'Module inconnu';
                let specialiteName = 'Spécialité inconnue';
                
                if (choix.module) {
                    if (typeof choix.module === 'object' && choix.module.nom) {
                        moduleName = choix.module.nom;
                    } else if (typeof choix.module === 'string') {
                        // Utiliser la map pour obtenir le nom du module depuis son ID
                        moduleName = modulesMap[choix.module] || choix.module;
                    }
                    }
                    
                    if (choix.specialite) {
                    if (typeof choix.specialite === 'object' && choix.specialite.nom) {
                            specialiteName = choix.specialite.nom;
                    } else if (typeof choix.specialite === 'string') {
                        specialiteName = choix.specialite;
                    }
                }
                
                // Vérifier si l'enseignant a de l'expérience avec ce module
                let experienceIndicator = '';
                if (voeu.modules_precedents_s2 && Array.isArray(voeu.modules_precedents_s2)) {
                    const moduleTeache = voeu.modules_precedents_s2.some(historyItem => 
                        historyItem.modules && historyItem.modules.some(m => 
                            m.nom && m.nom.toLowerCase() === moduleName.toLowerCase()
                        )
                    );
                    
                    if (moduleTeache) {
                        experienceIndicator = '<span class="badge bg-success ms-2" data-bs-toggle="tooltip" title="Déjà enseigné">Expérience <i class="bi bi-check-circle"></i></span>';
                    }
                }
                
                // Format des modules avec badges pour les types d'enseignement
                const natures = Array.isArray(choix.nature) ? choix.nature : [];
                const natureBadges = natures.map(nat => {
                    let badgeClass = 'bg-secondary';
                    if (nat.toLowerCase().includes('cours')) badgeClass = 'bg-primary';
                    if (nat.toLowerCase().includes('td')) badgeClass = 'bg-info';
                    if (nat.toLowerCase().includes('tp')) badgeClass = 'bg-success';
                    return `<span class="badge ${badgeClass} me-1">${nat}</span>`;
                }).join('');
                
                choixItems.push(`
                    <div class="card mb-2 border-0 shadow-sm">
                        <div class="card-body">
                            <h6 class="card-title text-primary d-flex align-items-center">
                                ${moduleName}${experienceIndicator}
                            </h6>
                            <div class="d-flex justify-content-between align-items-center">
                                <span class="text-muted"><i class="bi bi-bookmark me-1"></i>${specialiteName}</span>
                                <div>${natureBadges || '<span class="badge bg-secondary">Non spécifié</span>'}</div>
                            </div>
                        </div>
                    </div>
                `);
            }
            
            if (choixItems.length > 0) {
                choixS2Html = choixItems.join('');
            }
        }
        
        // Préparer l'affichage des modules précédemment enseignés
        let modulesPrecedentsS1Html = '<div class="alert alert-info">Aucun historique disponible</div>';
        if (voeu.modules_precedents_s1 && Array.isArray(voeu.modules_precedents_s1) && voeu.modules_precedents_s1.length > 0) {
            const historyItems = [];
            
            voeu.modules_precedents_s1.forEach(historyItem => {
                if (historyItem.modules && historyItem.modules.length > 0) {
                    const modulesList = historyItem.modules.map(m => 
                        `<li class="list-group-item py-1 px-2 border-0 bg-light">
                            <strong>${m.nom || 'Module non spécifié'}</strong>
                            ${m.specialite ? `<small class="text-muted"> - ${m.specialite}</small>` : ''}
                        </li>`
                    ).join('');
                    
                    historyItems.push(`
                        <div class="mb-2">
                            <h6 class="mb-1 small fw-bold">${historyItem.annee || 'Année non spécifiée'}</h6>
                            <ul class="list-group small rounded">${modulesList}</ul>
                        </div>
                    `);
                }
            });
            
            if (historyItems.length > 0) {
                modulesPrecedentsS1Html = historyItems.join('');
            }
        }
        
        let modulesPrecedentsS2Html = '<div class="alert alert-info">Aucun historique disponible</div>';
        if (voeu.modules_precedents_s2 && Array.isArray(voeu.modules_precedents_s2) && voeu.modules_precedents_s2.length > 0) {
            const historyItems = [];
            
            voeu.modules_precedents_s2.forEach(historyItem => {
                if (historyItem.modules && historyItem.modules.length > 0) {
                    const modulesList = historyItem.modules.map(m => 
                        `<li class="list-group-item py-1 px-2 border-0 bg-light">
                            <strong>${m.nom || 'Module non spécifié'}</strong>
                            ${m.specialite ? `<small class="text-muted"> - ${m.specialite}</small>` : ''}
                        </li>`
                    ).join('');
                    
                    historyItems.push(`
                        <div class="mb-2">
                            <h6 class="mb-1 small fw-bold">${historyItem.annee || 'Année non spécifiée'}</h6>
                            <ul class="list-group small rounded">${modulesList}</ul>
                        </div>
                    `);
                }
            });
            
            if (historyItems.length > 0) {
                modulesPrecedentsS2Html = historyItems.join('');
            }
        }
        
        // Vérifier département
        let departementInfo = 'Non spécifié';
        if (voeu.departement) {
            if (typeof voeu.departement === 'string') {
                departementInfo = voeu.departement;
            } else if (voeu.departement.nom) {
                departementInfo = voeu.departement.nom;
            } else if (voeu.departement.id && voeu.departement.nom) {
                departementInfo = voeu.departement.nom;
            }
        }
        
        // Date formatée
        const dateCreation = voeu.date_creation ? new Date(voeu.date_creation) : null;
        const dateFormatee = dateCreation ? dateCreation.toLocaleDateString() + ' à ' + dateCreation.toLocaleTimeString() : 'Non spécifié';
        
        // Ajout du sélecteur de statut pour permettre la modification
        let statusSelector = `
            <div class="mb-3">
                <label for="voeu-status-select" class="form-label fw-bold">Statut actuel :</label>
                <select id="voeu-status-select" class="form-select">
                    <option value="en_attente" ${voeu.statut === 'en_attente' ? 'selected' : ''}>En attente</option>
                    <option value="approuve" ${voeu.statut === 'approuve' ? 'selected' : ''}>Approuvé</option>
                    <option value="refuse" ${voeu.statut === 'refuse' ? 'selected' : ''}>Refusé</option>
                </select>
            </div>
        `;
        
        // Ajouter le sélecteur de statut au début du contenu
        content.innerHTML = `
            <div class="card mb-4 border-0 shadow-sm">
                <div class="card-header bg-primary text-white">
                    <h5 class="mb-0"><i class="bi bi-person-badge me-2"></i>Informations de l'enseignant</h5>
                </div>
                <div class="card-body">
                    <div class="row">
                <div class="col-md-6">
                            <p><strong>Nom :</strong> ${voeu.nom || 'Non spécifié'}</p>
                            <p><strong>Email :</strong> ${voeu.email || 'Non spécifié'}</p>
                            <p><strong>Téléphone :</strong> ${voeu.telephone || 'Non spécifié'}</p>
                </div>
                <div class="col-md-6">
                            <p><strong>Grade :</strong> ${voeu.grade || 'Non spécifié'}</p>
                            <p><strong>Bureau :</strong> ${voeu.bureau || 'Non spécifié'}</p>
                            <p><strong>Date de création :</strong> ${new Date(voeu.date_creation).toLocaleDateString()}</p>
                        </div>
                    </div>
                    ${statusSelector}
                </div>
            </div>
            
            <div class="row mb-4">
                <div class="col-md-6">
                    <div class="card h-100 border-0 shadow-sm">
                <div class="card-header bg-info text-white">
                            <h5 class="mb-0"><i class="bi bi-list-check me-2"></i>Choix Semestre 1</h5>
                </div>
                <div class="card-body">
                            ${choixS1Html}
                        </div>
                        </div>
                    </div>
                <div class="col-md-6">
                    <div class="card h-100 border-0 shadow-sm">
                        <div class="card-header bg-info text-white">
                            <h5 class="mb-0"><i class="bi bi-list-check me-2"></i>Choix Semestre 2</h5>
                        </div>
                        <div class="card-body">
                            ${choixS2Html}
                        </div>
                    </div>
                        </div>
                    </div>
                    
            <div class="row mb-4">
                <div class="col-md-6">
                    <div class="card h-100 border-0 shadow-sm">
                        <div class="card-header bg-secondary text-white">
                            <h5 class="mb-0"><i class="bi bi-clock-history me-2"></i>Historique Modules S1</h5>
                        </div>
                        <div class="card-body">
                            ${modulesPrecedentsS1Html}
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card h-100 border-0 shadow-sm">
                        <div class="card-header bg-secondary text-white">
                            <h5 class="mb-0"><i class="bi bi-clock-history me-2"></i>Historique Modules S2</h5>
                        </div>
                        <div class="card-body">
                            ${modulesPrecedentsS2Html}
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="card border-0 shadow-sm">
                <div class="card-header bg-secondary text-white">
                    <h5 class="mb-0"><i class="bi bi-chat-left-text me-2"></i>Commentaires</h5>
                </div>
                <div class="card-body">
                    <div class="p-3 bg-light rounded">
                        ${voeu.commentaires || '<em>Aucun commentaire</em>'}
                    </div>
                </div>
            </div>
        `;
        
        // Remplacer les boutons du footer par un seul bouton "Mettre à jour le statut"
        const modalFooter = document.querySelector('#voeuDetailModal .modal-footer');
        modalFooter.innerHTML = `
            <button type="button" class="btn btn-primary" id="update-status-btn">
                <i class="bi bi-save me-2"></i>Mettre à jour le statut
            </button>
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fermer</button>
        `;
        
        // Modifier le header de la modal
        const modalHeader = document.querySelector('#voeuDetailModal .modal-header');
        modalHeader.className = 'modal-header bg-dark text-white';
        const modalTitle = document.querySelector('#voeuDetailModal .modal-title');
        modalTitle.innerHTML = '<i class="bi bi-info-circle me-2"></i>Détail du vœu pédagogique';
        
        // Ajouter un gestionnaire d'événements pour le bouton de mise à jour
        document.getElementById('update-status-btn').addEventListener('click', function() {
            console.log('Bouton de mise à jour cliqué');
            const newStatus = document.getElementById('voeu-status-select').value;
            console.log('Nouveau statut:', newStatus, 'Statut actuel:', voeu.statut);
            
            // Vérifier si le statut a changé
            if (newStatus !== voeu.statut) {
                // Si le nouveau statut est "approuve"
                if (newStatus === 'approuve') {
                    console.log('Vérification de l\'expérience pour l\'approbation');
                    
                    // Identifier les modules spécifiques sans expérience
                    const modulesWithoutExp = identifyModulesWithoutExperience(voeu);
                    console.log('Modules sans expérience:', modulesWithoutExp);
                    
                    // S'il y a des modules sans expérience
                    if (modulesWithoutExp.length > 0) {
                        // Formater la liste des modules pour l'affichage
                        const modulesList = modulesWithoutExp.map(m => 
                            `<li class="text-warning"><strong>${m.name}</strong>${m.info || ''} (${m.semester})</li>`
                        ).join('');
                        
                        // Message personnalisé avec la liste des modules
                        const message = `
                            <p>Cet enseignant n'a pas d'expérience préalable avec les modules suivants:</p>
                            <ul class="ms-4 mt-2 mb-3">${modulesList}</ul>
                            <p>Voulez-vous quand même approuver ce vœu?</p>
                        `;
                        
                        console.log('Affichage du message de confirmation');
                        showStyledConfirmation(message, () => {
                            console.log('Confirmation approuvée malgré le manque d\'expérience');
                            updateVoeuStatus(voeuId, newStatus);
                        });
                    } else {
                        console.log('Tous les modules ont de l\'expérience, approbation directe');
                        updateVoeuStatus(voeuId, newStatus);
                    }
                } else {
                    console.log('Changement de statut sans vérification d\'expérience');
                    updateVoeuStatus(voeuId, newStatus);
                }
            } else {
                console.log('Pas de changement de statut, fermeture du modal');
                bootstrap.Modal.getInstance(document.getElementById('voeuDetailModal')).hide();
            }
        });
        
        // Activer les tooltips
        const tooltips = document.querySelectorAll('[data-bs-toggle="tooltip"]');
        tooltips.forEach(tooltip => {
            new bootstrap.Tooltip(tooltip);
        });
        
        // Afficher le modal
        modal.show();
    })
    .catch(error => {
        console.error('Erreur lors du chargement des détails du vœu:', error);
        alert('Erreur lors du chargement des détails: ' + error.message);
    });
}

// Fonction pour vérifier si l'enseignant a de l'expérience avec tous les modules demandés
function checkExperienceWithAllModules(voeu) {
    // Extraire tous les modules demandés (S1 et S2)
    const allRequestedModules = [];
    
    if (voeu.choix_s1 && Array.isArray(voeu.choix_s1)) {
        voeu.choix_s1.forEach(choix => {
            let moduleName = '';
            if (choix.module) {
                if (typeof choix.module === 'object' && choix.module.nom) {
                    moduleName = choix.module.nom.toLowerCase();
                } else if (typeof choix.module === 'string') {
                    moduleName = (modulesMap[choix.module] || choix.module).toLowerCase();
                }
                if (moduleName) {
                    allRequestedModules.push({
                        name: moduleName,
                        semester: 's1'
                    });
                }
            }
        });
    }
    
    if (voeu.choix_s2 && Array.isArray(voeu.choix_s2)) {
        voeu.choix_s2.forEach(choix => {
            let moduleName = '';
            if (choix.module) {
                if (typeof choix.module === 'object' && choix.module.nom) {
                    moduleName = choix.module.nom.toLowerCase();
                } else if (typeof choix.module === 'string') {
                    moduleName = (modulesMap[choix.module] || choix.module).toLowerCase();
                }
                if (moduleName) {
                    allRequestedModules.push({
                        name: moduleName,
                        semester: 's2'
                    });
                }
            }
        });
    }
    
    // Si aucun module demandé, retourner true (pas de vérification nécessaire)
    if (allRequestedModules.length === 0) {
        return true;
    }
    
    // Vérifier chaque module demandé
    for (const requestedModule of allRequestedModules) {
        let hasExperience = false;
        
        // Vérifier dans l'historique du semestre correspondant
        const historySemester = requestedModule.semester === 's1' ? 
            voeu.modules_precedents_s1 : voeu.modules_precedents_s2;
        
        if (historySemester && Array.isArray(historySemester)) {
            for (const historyItem of historySemester) {
                if (historyItem.modules && Array.isArray(historyItem.modules)) {
                    for (const historyModule of historyItem.modules) {
                        if (historyModule.nom && historyModule.nom.toLowerCase() === requestedModule.name) {
                            hasExperience = true;
                            break;
                        }
                    }
                }
                
                if (hasExperience) break;
            }
        }
        
        // Si aucune expérience pour ce module, retourner false
        if (!hasExperience) {
            return false;
        }
    }
    
    // Tous les modules ont de l'expérience
    return true;
}

// Fonction pour calculer la similarité entre deux chaînes de caractères
function areModulesSimilar(module1, module2) {
    // Si l'un des modules est vide ou non défini, retourner false
    if (!module1 || !module2) {
        console.log('Comparaison impossible: module vide', { module1, module2 });
        return false;
    }
    
    // Convertir en chaînes pour être sûr
    const str1 = String(module1);
    const str2 = String(module2);
    
    // Afficher les modules comparés pour débogage
    console.log('Comparaison de modules:', { module1: str1, module2: str2 });
    
    // Nettoyage des chaînes en supprimant les caractères spéciaux, accents, etc.
    const cleanText = (text) => {
        return text
            .toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Supprime les accents
            .replace(/[^a-z0-9]/g, " ")                        // Garde uniquement lettres et chiffres
            .replace(/\s+/g, " ")                             // Remplace les espaces multiples par un seul
            .trim();
    };
    
    const clean1 = cleanText(str1);
    const clean2 = cleanText(str2);
    
    console.log('Après nettoyage:', { clean1, clean2 });
    
    // 1. Vérifier l'égalité exacte après nettoyage
    if (clean1 === clean2) {
        console.log('✓ Modules identiques après nettoyage');
        return true;
    }
    
    // 2. Vérifier si une chaîne contient l'autre
    if (clean1.includes(clean2) || clean2.includes(clean1)) {
        console.log('✓ Un module contient l\'autre');
        return true;
    }
    
    // Extraire les parties clés (nom du module sans niveau ou spécialité)
    // Par exemple "Analyse 1 - L1 Ingénieur" -> "Analyse 1"
    const extractModuleName = (text) => {
        // Chercher le nom du module avant un tiret ou une parenthèse
        const dashIndex = text.indexOf('-');
        const parenIndex = text.indexOf('(');
        
        let endIndex = text.length;
        if (dashIndex > 0) endIndex = Math.min(endIndex, dashIndex);
        if (parenIndex > 0) endIndex = Math.min(endIndex, parenIndex);
        
        return text.substring(0, endIndex).trim();
    };
    
    const coreName1 = cleanText(extractModuleName(str1));
    const coreName2 = cleanText(extractModuleName(str2));
    
    console.log('Noms de base des modules:', { coreName1, coreName2 });
    
    // Comparer les noms de base
    if (coreName1 === coreName2) {
        console.log('✓ Noms de base des modules identiques');
        return true;
    }
    
    // 3. Vérifier les acronymes
    const words1 = clean1.split(" ");
    const words2 = clean2.split(" ");
    
    if (words1.length > 1) {
        const acronym = words1.map(word => word[0]).join("");
        if (acronym === clean2.replace(/\s/g, '')) {
            console.log('✓ Le module 1 est l\'acronyme du module 2');
            return true;
        }
    }
    
    if (words2.length > 1) {
        const acronym = words2.map(word => word[0]).join("");
        if (acronym === clean1.replace(/\s/g, '')) {
            console.log('✓ Le module 2 est l\'acronyme du module 1');
            return true;
        }
    }
    
    // 4. Calculer la similarité de Jaccard basée sur les mots
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    const similarity = intersection.size / union.size;
    console.log('Similarité Jaccard:', similarity);
    
    // Si la similarité est supérieure à 0.4 (40%), considérer les modules comme similaires
    if (similarity > 0.4) {
        console.log('✓ Modules similaires selon Jaccard');
        return true;
    }
    
    // 5. Vérifier la similarité avec les lettres numériques
    const romanNumerals = {
        "1": "i", "2": "ii", "3": "iii", "4": "iv", "5": "v",
        "6": "vi", "7": "vii", "8": "viii", "9": "ix"
    };
    
    // Remplacer les chiffres par leur équivalent romain et revérifier
    let romanized1 = clean1;
    let romanized2 = clean2;
    
    Object.keys(romanNumerals).forEach(num => {
        const roman = romanNumerals[num];
        romanized1 = romanized1.replace(new RegExp(`\\b${num}\\b`, 'g'), roman);
        romanized2 = romanized2.replace(new RegExp(`\\b${num}\\b`, 'g'), roman);
    });
    
    console.log('Avec chiffres romains:', { romanized1, romanized2 });
    
    if (romanized1 === romanized2) {
        console.log('✓ Modules identiques après conversion romaine');
        return true;
    }
    
    // 6. Vérification spécifique pour les modules d'analyse et d'algèbre avec niveaux
    // Ex: "Analyse 1", "Algebre 2", etc.
    const modulePattern = /^(analyse|algebre|algebra|algorithm|algorithme)\s*(\d+|i|ii|iii|iv|v)$/i;
    
    const match1 = clean1.match(modulePattern);
    const match2 = clean2.match(modulePattern);
    
    if (match1 && match2 && match1[1] === match2[1] && match1[2] === match2[2]) {
        console.log('✓ Modules de même type et niveau');
        return true;
    }
    
    console.log('✗ Modules différents');
    return false;
}

// Ajouter cette fonction de confirmation stylisée à la fin du fichier
function showStyledConfirmation(message, onConfirm, onCancel) {
    // Créer le conteneur de l'alerte s'il n'existe pas déjà
    let alertContainer = document.getElementById('custom-alert-container');
    if (!alertContainer) {
        alertContainer = document.createElement('div');
        alertContainer.id = 'custom-alert-container';
        alertContainer.style.position = 'fixed';
        alertContainer.style.top = '0';
        alertContainer.style.left = '0';
        alertContainer.style.width = '100%';
        alertContainer.style.height = '100%';
        alertContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        alertContainer.style.display = 'flex';
        alertContainer.style.justifyContent = 'center';
        alertContainer.style.alignItems = 'center';
        alertContainer.style.zIndex = '9999';
        document.body.appendChild(alertContainer);
    }

    // Créer le contenu de l'alerte avec une div pour le message
    const alertBox = document.createElement('div');
    alertBox.className = 'alert-box bg-dark text-white p-4 rounded shadow-lg';
    alertBox.style.maxWidth = '500px';
    alertBox.style.transform = 'scale(0.5)';
    alertBox.style.opacity = '0';
    alertBox.style.transition = 'all 0.3s ease';
    alertBox.style.maxHeight = '80vh';
    alertBox.style.overflow = 'auto';
    
    alertBox.innerHTML = `
        <div class="d-flex align-items-center mb-3">
            <i class="bi bi-exclamation-triangle-fill text-warning fs-1 me-3"></i>
            <h5 class="mb-0">Confirmation requise</h5>
        </div>
        <div id="alert-message-content"></div>
        <div class="d-flex justify-content-end mt-4">
            <button id="cancel-btn" class="btn btn-outline-light me-2">Annuler</button>
            <button id="confirm-btn" class="btn btn-primary">OK</button>
        </div>
    `;
    
    // Vider le contenant et ajouter la boîte d'alerte
    alertContainer.innerHTML = '';
    alertContainer.appendChild(alertBox);
    
    // Insérer le contenu HTML du message
    document.getElementById('alert-message-content').innerHTML = message;

    // Animer l'apparition
    setTimeout(() => {
        alertBox.style.transform = 'scale(1)';
        alertBox.style.opacity = '1';
    }, 10);

    // Ajouter les écouteurs d'événements
    document.getElementById('confirm-btn').addEventListener('click', function() {
        // Animer la disparition
        alertBox.style.transform = 'scale(0.5)';
        alertBox.style.opacity = '0';
        
        setTimeout(() => {
            alertContainer.remove();
            if (onConfirm) onConfirm();
        }, 300);
    });

    document.getElementById('cancel-btn').addEventListener('click', function() {
        // Animer la disparition
        alertBox.style.transform = 'scale(0.5)';
        alertBox.style.opacity = '0';
        
        setTimeout(() => {
            alertContainer.remove();
            if (onCancel) onCancel();
        }, 300);
    });
}

// Mettre à jour le statut d'un vœu
function updateVoeuStatus(voeuId, status) {
    const token = localStorage.getItem('token');
    
    fetch(`/api/voeux/${voeuId}/statut`, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ statut: status })
    })
    .then(response => response.json())
    .then(data => {
        // Déterminer le type d'alerte et le message en fonction du statut
        let alertClass, alertIcon, statusText;
        
        switch(status) {
            case 'approuve':
                alertClass = 'success';
                alertIcon = 'check-circle-fill';
                statusText = 'approuvé';
                break;
            case 'refuse':
                alertClass = 'danger';
                alertIcon = 'x-circle-fill';
                statusText = 'refusé';
                break;
            default: // en_attente
                alertClass = 'warning';
                alertIcon = 'exclamation-triangle-fill';
                statusText = 'mis en attente';
        }
        
        // Créer une alerte stylisée
        let alertMessage = `
            <div class="alert alert-${alertClass} shadow-sm border-0 d-flex align-items-center" role="alert" 
                style="animation: fadeInDown 0.5s ease-out;">
                <i class="bi bi-${alertIcon} me-2 fs-4"></i>
                <div>
                    Statut du vœu ${statusText} avec succès
                </div>
            </div>
        `;
        
        // Ajouter un style d'animation si ce n'est pas déjà présent
        if (!document.getElementById('alert-animations-style')) {
            const style = document.createElement('style');
            style.id = 'alert-animations-style';
            style.textContent = `
                @keyframes fadeInDown {
                    from {
                        opacity: 0;
                        transform: translateY(-20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        // Afficher l'alerte en haut du tableau des vœux
        const alertContainer = document.getElementById('voeux-alerts');
        alertContainer.innerHTML = alertMessage;
        
        // Supprimer l'alerte après 3 secondes
        setTimeout(() => {
            alertContainer.innerHTML = '';
        }, 3000);
        
        // Fermer le modal
        bootstrap.Modal.getInstance(document.getElementById('voeuDetailModal')).hide();
        
        // Recharger les vœux
        loadVoeux();
    })
    .catch(error => {
        console.error('Erreur lors de la mise à jour du statut:', error);
        
        // Afficher une alerte d'erreur
        const alertContainer = document.getElementById('voeux-alerts');
        alertContainer.innerHTML = `
            <div class="alert alert-danger shadow-sm border-0 d-flex align-items-center" role="alert">
                <i class="bi bi-exclamation-circle-fill me-2 fs-4"></i>
                <div>
                    Erreur lors de la mise à jour du statut : ${error.message || 'Une erreur est survenue'}
                </div>
            </div>
        `;
        
        // Supprimer l'alerte après 5 secondes
        setTimeout(() => {
            alertContainer.innerHTML = '';
        }, 5000);
    });
}

// Initialisation de l'organigramme
function initOrganigramme() {
    const token = localStorage.getItem('token');
    
    // Charger les années disponibles
    fetch('/api/voeux/data/annees', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(data => {
        const selectAnnee = document.getElementById('filter-organigramme-annee');
        selectAnnee.innerHTML = '<option value="">Sélectionner une année</option>';
        
        if (Array.isArray(data)) {
            data.forEach(annee => {
                const option = document.createElement('option');
                option.value = annee;
                option.textContent = annee;
                selectAnnee.appendChild(option);
            });
        }
    })
    .catch(error => console.error('Erreur lors du chargement des années:', error));
    
    // Charger les spécialités pour le filtre
    fetch('/api/specialites', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(data => {
        const selectSpecialite = document.getElementById('filter-organigramme-specialite');
        selectSpecialite.innerHTML = '<option value="">Toutes les spécialités</option>';
        
        data.forEach(specialite => {
            const option = document.createElement('option');
            option.value = specialite._id;
            option.textContent = specialite.nom;
            selectSpecialite.appendChild(option);
        });
    })
    .catch(error => console.error('Erreur:', error));
    
    // Écouteur pour le bouton de génération
    document.getElementById('generate-organigramme').addEventListener('click', generateOrganigramme);
    
    // Écouteurs pour les boutons d'export
    document.getElementById('export-pdf').addEventListener('click', exportOrganigrammePDF);
    document.getElementById('export-excel').addEventListener('click', exportOrganigrammeExcel);
}

// Générer l'organigramme
function generateOrganigramme() {
    const token = localStorage.getItem('token');
    const annee = document.getElementById('filter-organigramme-annee').value;
    const specialite = document.getElementById('filter-organigramme-specialite').value;
    
    if (!annee) {
        alert('Veuillez sélectionner une année académique');
        return;
    }
    
    // Afficher un message de chargement
    const container = document.getElementById('organigramme');
    container.innerHTML = '<div class="alert alert-info">Chargement de l\'organigramme en cours...</div>';
    
    // Journalisation des paramètres
    console.log('Génération de l\'organigramme avec les paramètres:', { annee, specialite });
    
    fetch('/api/admin/organigramme', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            annee,
            specialite: specialite || null
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        // Journaliser les données reçues pour le débogage
        console.log('Données reçues pour l\'organigramme:', data);
        
        // Vérifier si les données contiennent des modules
        if (!data.modules || !Array.isArray(data.modules) || data.modules.length === 0) {
            container.innerHTML = `
                <div class="alert alert-warning">
                    <h4>Aucun module trouvé</h4>
                    <p>Aucun module n'a été trouvé pour cette année académique${specialite ? ' et cette spécialité' : ''}.</p>
                    <p>Veuillez vérifier qu'il y a des vœux approuvés pour cette période.</p>
                </div>
            `;
            return;
        }
        
        // Afficher l'organigramme
        container.innerHTML = '';
        
        // Créer la structure de données pour l'organigramme
        const orgData = {
            name: 'Département',
            title: data.departement || 'Département Informatique',
            children: []
        };
        
        // Organiser par spécialité
        const specialites = {};
        
        // Compter le nombre de modules pour chaque spécialité
        let moduleCount = 0;
        
        data.modules.forEach(module => {
            // Vérifier que le module a bien une spécialité
            if (!module || !module.specialite) {
                console.warn('Module sans spécialité détecté:', module);
                return;
            }
            
            moduleCount++;
            const specialiteName = module.specialite;
            
            if (!specialites[specialiteName]) {
                specialites[specialiteName] = {
                    name: specialiteName,
                    title: 'Spécialité',
                    children: []
                };
            }
            
            const moduleNode = {
                name: module.nom || 'Module sans nom',
                title: Array.isArray(module.enseignants) && module.enseignants.length > 0 
                    ? module.enseignants.map((enseignant, index) => {
                        // Récupérer le statut correspondant à cet enseignant
                        const statut = module.statuts && module.statuts[index] 
                            ? module.statuts[index] 
                            : 'en_attente';
                        
                        // Ajouter une icône ou un indicateur de couleur selon le statut
                        let statusIcon = '🟠'; // Par défaut: en attente (orange)
                        if (statut === 'approuve') {
                            statusIcon = '🟢'; // Approuvé (vert)
                        } else if (statut === 'refuse') {
                            statusIcon = '🔴'; // Refusé (rouge)
                        }
                        
                        return `${statusIcon} ${enseignant}`;
                    }).join('<br>') 
                    : 'Aucun enseignant',
                className: 'module-node'
            };
            
            specialites[specialiteName].children.push(moduleNode);
        });
        
        console.log('Nombre de modules traités:', moduleCount);
        console.log('Spécialités générées:', Object.keys(specialites));
        
        // Vérifier si des modules ont été ajoutés
        if (moduleCount === 0) {
            container.innerHTML = `
                <div class="alert alert-warning">
                    <h4>Aucun module valide trouvé</h4>
                    <p>Les modules récupérés ne contiennent pas les informations nécessaires.</p>
                    <p>Veuillez vérifier la structure des données retournées par l'API.</p>
                </div>
            `;
            return;
        }
        
        // Ajouter les spécialités à l'organigramme
        for (const key in specialites) {
            orgData.children.push(specialites[key]);
        }
        
        // Vérifier si jQuery et html2canvas sont chargés
        if (typeof $ === 'undefined') {
            container.innerHTML = '<div class="alert alert-danger">Erreur: jQuery non chargé</div>';
            return;
        }
        
        try {
            // Détruire l'organigramme existant s'il existe
            if ($(container).data('orgchart')) {
                $(container).orgchart('destroy');
            }
            
            // Initialiser l'organigramme avec des options explicites
            $(container).orgchart({
                data: orgData,
                nodeContent: 'title',
                exportButton: false,
                exportFilename: `organigramme-${annee}`,
                direction: 't2b', // Affichage de haut en bas pour une meilleure visibilité
                nodeID: 'id',
                createNode: function($node, data) {
                    // Personnaliser les nœuds si nécessaire
                    if (data.className) {
                        $node.addClass(data.className);
                    }
                }
            });
            
            console.log('Organigramme généré avec succès');
            
            // Ajouter une légende pour les statuts
            const legendDiv = document.createElement('div');
            legendDiv.className = 'alert alert-info mt-3';
            legendDiv.innerHTML = `
                <h5>Légende des statuts :</h5>
                <div class="d-flex flex-column gap-2">
                    <div><span style="color: green;">🟢</span> Vœu approuvé</div>
                    <div><span style="color: orange;">🟠</span> Vœu en attente</div>
                    <div><span style="color: red;">🔴</span> Vœu refusé</div>
                </div>
                <p class="mt-2 mb-0 small">L'organigramme affiche maintenant tous les vœux soumis, pas uniquement ceux qui sont approuvés.</p>
            `;
            document.getElementById('organigramme-container').appendChild(legendDiv);
            
            // Activer les boutons d'export
            document.getElementById('export-pdf').classList.remove('disabled');
            document.getElementById('export-excel').classList.remove('disabled');
        } catch (error) {
            console.error('Erreur lors de la génération de l\'organigramme:', error);
            container.innerHTML = `<div class="alert alert-danger">Erreur lors de la génération de l'organigramme: ${error.message}</div>`;
        }
    })
    .catch(error => {
        console.error('Erreur lors de la récupération des données:', error);
        document.getElementById('organigramme').innerHTML = `
            <div class="alert alert-danger">
                Erreur lors de la récupération des données: ${error.message}
            </div>
        `;
    });
}

// Exporter l'organigramme en PDF
function exportOrganigrammePDF() {
    // Vérifier que l'organigramme existe
    const organigrammeContainer = document.getElementById('organigramme');
    if (!organigrammeContainer || !organigrammeContainer.querySelector('.orgchart')) {
        alert('Veuillez d\'abord générer l\'organigramme');
        return;
    }

    // Vérifier que les librairies nécessaires sont chargées
    if (typeof html2canvas === 'undefined') {
        alert('Erreur: La librairie html2canvas n\'est pas chargée.');
        return;
    }
    
    if (typeof window.jspdf === 'undefined') {
        alert('Erreur: La librairie jsPDF n\'est pas chargée.');
        return;
    }
    
    // Utiliser html2canvas pour capturer l'organigramme
    const chartContainer = organigrammeContainer.querySelector('.orgchart');
    
    // Informer l'utilisateur que l'export est en cours
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'alert alert-info';
    loadingDiv.textContent = 'Génération du PDF en cours...';
    organigrammeContainer.appendChild(loadingDiv);
    
    try {
        // Utiliser une promesse pour capturer l'organigramme
        html2canvas(chartContainer, {
            scale: 0.8, // Réduire légèrement pour garantir que tout rentre
            logging: true,
            useCORS: true,
            allowTaint: true
        }).then(canvas => {
            // Créer le PDF avec l'image du canvas
            const { jsPDF } = window.jspdf;
            const imgData = canvas.toDataURL('image/jpeg', 0.8);
            
            // Obtenir les dimensions pour le PDF
            const imgWidth = 280; // largeur en mm (A4 landscape)
            const pageHeight = 210;  // hauteur en mm (A4 landscape)
            const imgHeight = canvas.height * imgWidth / canvas.width;
            
            // Créer le document PDF en mode paysage
            const doc = new jsPDF('landscape', 'mm', 'a4');
            
            // Titre du document
            doc.setFontSize(16);
            doc.text('Organigramme du département', 15, 15);
            
            // Date de génération
            doc.setFontSize(10);
            doc.text(`Généré le ${new Date().toLocaleDateString()}`, 15, 22);
            
            // Ajouter l'image
            doc.addImage(imgData, 'JPEG', 15, 30, imgWidth, imgHeight);
            
            // Enregistrer le PDF
            const annee = document.getElementById('filter-organigramme-annee').value || 'actuel';
            doc.save(`organigramme-${annee}.pdf`);
            
            // Supprimer le message de chargement
            organigrammeContainer.removeChild(loadingDiv);
        });
    } catch (error) {
        console.error('Erreur lors de l\'export PDF:', error);
        alert(`Erreur lors de l\'export PDF: ${error.message}`);
        
        // Supprimer le message de chargement en cas d'erreur
        if (loadingDiv.parentNode) {
            organigrammeContainer.removeChild(loadingDiv);
        }
    }
}

// Exporter l'organigramme en Excel
function exportOrganigrammeExcel() {
    const token = localStorage.getItem('token');
    const annee = document.getElementById('filter-organigramme-annee').value;
    const specialite = document.getElementById('filter-organigramme-specialite').value;
    
    if (!annee) {
        alert('Veuillez sélectionner une année académique');
        return;
    }
    
    // Vérifier si l'organigramme a déjà été généré
    const organigrammeContainer = document.getElementById('organigramme');
    const isOrganigrammeGenerated = organigrammeContainer.querySelector('.orgchart');
    
    if (!isOrganigrammeGenerated) {
        const generateFirst = confirm('L\'organigramme n\'a pas encore été généré. Voulez-vous le générer maintenant?');
        if (generateFirst) {
            generateOrganigramme();
        }
        return;
    }
    
    // Afficher un message de progression
    const exportStatus = document.createElement('div');
    exportStatus.className = 'alert alert-info';
    exportStatus.textContent = 'Génération du fichier Excel en cours...';
    organigrammeContainer.appendChild(exportStatus);
    
    console.log('Demande d\'export Excel avec les paramètres:', { annee, specialite });
    
    fetch('/api/admin/organigramme', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            annee,
            specialite: specialite || null
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('Données reçues pour l\'export Excel:', data);
        
        // Vérifier si les données sont valides
        if (!data.modules || !Array.isArray(data.modules) || data.modules.length === 0) {
            throw new Error('Aucun module trouvé pour cette année académique');
        }
        
        // Créer un tableau pour Excel
        if (typeof XLSX === 'undefined') {
            throw new Error('La librairie XLSX n\'est pas chargée');
        }
        
        const wb = XLSX.utils.book_new();
        
        // Données pour le fichier Excel
        const excelData = [];
        
        // En-têtes
        excelData.push(['Spécialité', 'Module', 'Enseignants', 'Statuts']);
        
        let moduleCount = 0;
        
        // Ajouter les modules
        data.modules.forEach(module => {
            if (module && module.specialite && module.nom) {
                moduleCount++;
                
                // Préparer les statuts formatés
                const statutsFormatted = Array.isArray(module.statuts) 
                    ? module.statuts.map(statut => {
                        if (statut === 'approuve') return 'Approuvé';
                        if (statut === 'refuse') return 'Refusé';
                        return 'En attente';
                    }).join(', ')
                    : 'Non défini';
                
                excelData.push([
                    module.specialite,
                    module.nom,
                    Array.isArray(module.enseignants) ? module.enseignants.join(', ') : 'Aucun enseignant',
                    statutsFormatted
                ]);
            } else {
                console.warn('Module incomplet ignoré:', module);
            }
        });
        
        console.log(`${moduleCount} modules ajoutés à l'Excel`);
        
        if (moduleCount === 0) {
            throw new Error('Aucun module valide trouvé pour l\'export');
        }
        
        // Créer une feuille de calcul
        const ws = XLSX.utils.aoa_to_sheet(excelData);
        
        // Ajouter la feuille au classeur
        XLSX.utils.book_append_sheet(wb, ws, 'Organigramme');
        
        // Télécharger le fichier Excel
        XLSX.writeFile(wb, `organigramme-${annee}.xlsx`);
        
        // Supprimer le message de progression
        organigrammeContainer.removeChild(exportStatus);
        
        console.log('Export Excel terminé avec succès');
    })
    .catch(error => {
        console.error('Erreur lors de l\'export Excel:', error);
        
        // Mettre à jour le message de statut en cas d'erreur
        exportStatus.className = 'alert alert-danger';
        exportStatus.textContent = `Erreur lors de l'export: ${error.message}`;
        
        // Supprimer le message après 5 secondes
        setTimeout(() => {
            if (exportStatus.parentNode) {
                organigrammeContainer.removeChild(exportStatus);
            }
        }, 5000);
    });
}

// Ajouter cette fonction pour le style des heures supplémentaires
function getHeuresSuppStyle(heures) {
    heures = parseFloat(heures) || 0;
    if (heures === 0) return 'bg-secondary';
    if (heures <= 3) return 'bg-success';
    if (heures <= 6) return 'bg-info';
    return 'bg-warning';
}

// Ajouter des fonctions de gestion des filtres améliorés

// Fonction pour ajouter un badge de filtre actif
function addActiveFilter(containerId, filterName, filterValue, displayText) {
    const container = document.getElementById(containerId);
    const filterId = `filter-${filterName}-${filterValue.replace(/\s+/g, '-').toLowerCase()}`;
    
    // Vérifier si le filtre existe déjà
    if (document.getElementById(filterId)) {
        return;
    }
    
    const badge = document.createElement('span');
    badge.id = filterId;
    badge.className = 'filter-badge';
    badge.innerHTML = `
        ${displayText}
        <span class="badge-remove" data-filter="${filterName}" data-value="${filterValue}">
            <i class="bi bi-x-circle"></i>
        </span>
    `;
    
    container.appendChild(badge);
    
    // Ajouter un écouteur d'événements pour supprimer le filtre
    badge.querySelector('.badge-remove').addEventListener('click', function() {
        const filterType = this.getAttribute('data-filter');
        const filterValue = this.getAttribute('data-value');
        
        // Réinitialiser le select correspondant
        const selectElement = document.getElementById(`filter-${filterType}`);
        if (selectElement) {
            selectElement.value = '';
        }
        
        // Supprimer le badge
        badge.remove();
        
        // Appliquer les filtres mis à jour
        if (containerId === 'modules-active-filters') {
            filterModules();
        } else if (containerId === 'enseignants-active-filters') {
            filterEnseignants();
        } else if (containerId === 'voeux-active-filters') {
            filterVoeux();
        }
    });
}

// Fonctions de réinitialisation des filtres
function resetModulesFilters() {
    document.getElementById('filter-specialite').value = '';
    document.getElementById('filter-semestre').value = '';
    document.getElementById('filter-nature').value = '';
    document.getElementById('filter-module-enseignants').value = '';
    document.getElementById('search-module').value = '';
    document.getElementById('modules-active-filters').innerHTML = '';
    filterModules();
}

function resetEnseignantsFilters() {
    document.getElementById('filter-grade').value = '';
    document.getElementById('filter-departement').value = '';
    document.getElementById('filter-enseignant-statut').value = '';
    document.getElementById('search-enseignant').value = '';
    document.getElementById('enseignants-active-filters').innerHTML = '';
    filterEnseignants();
}

function resetVoeuxFilters() {
    document.getElementById('filter-annee').value = '';
    document.getElementById('filter-statut').value = '';
    document.getElementById('filter-voeux-grade').value = '';
    document.getElementById('filter-heures-supp').value = '';
    document.getElementById('search-voeu').value = '';
    document.getElementById('voeux-active-filters').innerHTML = '';
    filterVoeux();
}

// Fonction pour mettre à jour le compteur de résultats des filtres
function updateFilterResultsCount(tableId, filtersContainerId) {
    const table = document.getElementById(tableId);
    const rows = table.getElementsByTagName('tr');
    
    let visibleCount = 0;
    for (let i = 0; i < rows.length; i++) {
        if (rows[i].style.display !== 'none') {
            visibleCount++;
        }
    }
    
    const filtersContainer = document.getElementById(filtersContainerId);
    
    // Créer ou mettre à jour le compteur
    let counter = filtersContainer.querySelector('.filter-counter');
    if (!counter) {
        counter = document.createElement('div');
        counter.className = 'filter-counter mt-2 text-muted small';
        filtersContainer.appendChild(counter);
    }
    
    counter.textContent = `${visibleCount} résultat${visibleCount !== 1 ? 's' : ''} affiché${visibleCount !== 1 ? 's' : ''}`;
}

// Chargement des utilisateurs (pour le superadmin)
function loadUsers() {
    const token = localStorage.getItem('token');
    
    fetch('/api/admin/users', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Accès refusé');
        }
        return response.json();
    })
    .then(data => {
        const usersTable = document.getElementById('users-table');
        usersTable.innerHTML = '';
        
        // Vérifier si data est un tableau (API retourne directement les données)
        // ou si c'est un objet avec une propriété data (format {data: [...], success: true})
        const usersArray = Array.isArray(data) ? data : (data.data || []);
        
        usersArray.forEach(user => {
            const tr = document.createElement('tr');
            
            // Formater la date de création
            const dateCreation = new Date(user.date_creation);
            const formattedDate = `${dateCreation.toLocaleDateString()} ${dateCreation.toLocaleTimeString()}`;
            
            // Déterminer le badge de rôle
            let roleBadge = '';
            if (user.role === 'superadmin') {
                roleBadge = '<span class="badge bg-danger">Super Administrateur</span>';
            } else if (user.role === 'admin') {
                roleBadge = '<span class="badge bg-success">Administrateur</span>';
            } else {
                roleBadge = '<span class="badge bg-secondary">Utilisateur</span>';
            }
            
            // Déterminer qui a promu l'utilisateur
            let promotedBy = 'N/A';
            if (user.promotedBy && user.promotedBy.username) {
                promotedBy = user.promotedBy.username;
            }
            
            // Déterminer les actions disponibles
            let actions = '';
            if (user.role === 'user') {
                actions = `<button class="btn btn-sm btn-success" onclick="promoteUser('${user._id}')">
                    <i class="bi bi-arrow-up-circle"></i> Promouvoir
                </button>`;
            } else if (user.role === 'admin') {
                actions = `<button class="btn btn-sm btn-danger" onclick="demoteUser('${user._id}')">
                    <i class="bi bi-arrow-down-circle"></i> Rétrograder
                </button>`;
            } else if (user.role === 'superadmin') {
                // Pas d'actions disponibles pour le superadmin
                actions = '<span class="badge bg-info">Aucune action possible</span>';
            }
            
            tr.innerHTML = `
                <td>${user.username}</td>
                <td>${user.email}</td>
                <td>${roleBadge}</td>
                <td>${formattedDate}</td>
                <td>${promotedBy}</td>
                <td>${actions}</td>
            `;
            
            usersTable.appendChild(tr);
        });
        
        // Si aucun utilisateur n'est trouvé
        if (usersArray.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = '<td colspan="6" class="text-center">Aucun utilisateur trouvé</td>';
            usersTable.appendChild(tr);
        }
    })
    .catch(error => {
        console.error('Erreur:', error);
        
        // Afficher l'erreur dans le tableau
        const usersTable = document.getElementById('users-table');
        if (usersTable) {
            usersTable.innerHTML = `<tr><td colspan="6" class="text-center text-danger">
                <i class="bi bi-exclamation-triangle-fill me-2"></i>
                Erreur: ${error.message || 'Vous n\'avez pas les droits pour accéder à cette ressource'}
            </td></tr>`;
        } else {
            alert('Vous n\'avez pas les droits pour accéder à cette ressource');
        }
    });
}

// Promouvoir un utilisateur au rôle d'admin
function promoteUser(userId) {
    // Configuration du modal de confirmation
    showUserActionModal({
        title: 'Promotion d\'utilisateur',
        message: 'Voulez-vous vraiment promouvoir cet utilisateur au rôle d\'administrateur ?',
        infoText: 'Cette action donnéra à l\'utilisateur des droits d\'administration sur la plateforme.',
        confirmText: 'Promouvoir',
        confirmClass: 'btn-success',
        confirmIcon: 'bi-arrow-up-circle',
        actionCallback: () => {
            const token = localStorage.getItem('token');
            
            // Récupérer le bouton de confirmation
            const confirmBtn = document.getElementById('userActionConfirmBtn');
            if (!confirmBtn) {
                console.error('Bouton de confirmation non trouvé');
                return;
            }
            
            // Désactiver le bouton pour éviter les clics multiples
            confirmBtn.disabled = true;
            
            fetch(`/api/admin/users/${userId}/promote`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Échec de la promotion: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                // Fermer le modal de façon sécurisée
                try {
                    const modalElement = document.getElementById('userActionModal');
                    if (modalElement) {
                        const modalInstance = bootstrap.Modal.getInstance(modalElement);
                        if (modalInstance) {
                            modalInstance.hide();
                        } else {
                            // Fallback si getInstance ne fonctionne pas
                            $(modalElement).modal('hide');
                        }
                    }
                } catch (error) {
                    console.error('Erreur lors de la fermeture du modal:', error);
                    // Fermeture alternative du modal en cas d'erreur
                    const modalElement = document.getElementById('userActionModal');
                    if (modalElement) {
                        modalElement.classList.remove('show');
                        modalElement.style.display = 'none';
                        document.body.classList.remove('modal-open');
                        const backdrops = document.getElementsByClassName('modal-backdrop');
                        while (backdrops.length > 0) {
                            backdrops[0].parentNode.removeChild(backdrops[0]);
                        }
                    }
                }
                
                // Afficher un message de succès avec du style
                showSuccessToast(data.message || 'Utilisateur promu avec succès');
                
                // Recharger la liste des utilisateurs
                setTimeout(() => {
                    loadUsers();
                }, 500);
            })
            .catch(error => {
                console.error('Erreur de promotion:', error);
                
                // Réactiver le bouton
                if (confirmBtn) {
                    confirmBtn.disabled = false;
                }
                
                // Afficher l'erreur dans le modal
                const infoElement = document.getElementById('userActionModalInfo');
                if (infoElement) {
                    infoElement.className = 'alert alert-danger d-flex align-items-center';
                    infoElement.innerHTML = 
                        '<i class="bi bi-exclamation-triangle-fill me-2 fs-5"></i>' +
                        `<span>Une erreur est survenue lors de la promotion de l'utilisateur: ${error.message}</span>`;
                } else {
                    // Fallback si l'élément n'est pas trouvé
                    alert('Une erreur est survenue lors de la promotion de l\'utilisateur');
                }
            });
        }
    });
}

// Rétrograder un administrateur au rôle d'utilisateur
function demoteUser(userId) {
    // Configuration du modal de confirmation
    showUserActionModal({
        title: 'Rétrogradation d\'administrateur',
        message: 'Voulez-vous vraiment rétrograder cet administrateur au rôle d\'utilisateur ordinaire ?',
        infoText: 'Cette action retirera tous les droits d\'administration à cet utilisateur.',
        confirmText: 'Rétrograder',
        confirmClass: 'btn-danger',
        confirmIcon: 'bi-arrow-down-circle',
        actionCallback: () => {
            const token = localStorage.getItem('token');
            
            // Récupérer le bouton de confirmation
            const confirmBtn = document.getElementById('userActionConfirmBtn');
            if (!confirmBtn) {
                console.error('Bouton de confirmation non trouvé');
                return;
            }
            
            // Désactiver le bouton pour éviter les clics multiples
            confirmBtn.disabled = true;
            
            fetch(`/api/admin/users/${userId}/demote`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Échec de la rétrogradation: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                // Fermer le modal de façon sécurisée
                try {
                    const modalElement = document.getElementById('userActionModal');
                    if (modalElement) {
                        const modalInstance = bootstrap.Modal.getInstance(modalElement);
                        if (modalInstance) {
                            modalInstance.hide();
                        } else {
                            // Fallback si getInstance ne fonctionne pas
                            $(modalElement).modal('hide');
                        }
                    }
                } catch (error) {
                    console.error('Erreur lors de la fermeture du modal:', error);
                    // Fermeture alternative du modal en cas d'erreur
                    const modalElement = document.getElementById('userActionModal');
                    if (modalElement) {
                        modalElement.classList.remove('show');
                        modalElement.style.display = 'none';
                        document.body.classList.remove('modal-open');
                        const backdrops = document.getElementsByClassName('modal-backdrop');
                        while (backdrops.length > 0) {
                            backdrops[0].parentNode.removeChild(backdrops[0]);
                        }
                    }
                }
                
                // Afficher un message de succès avec du style
                showSuccessToast(data.message || 'Administrateur rétrogradé avec succès');
                
                // Recharger la liste des utilisateurs
                setTimeout(() => {
                    loadUsers();
                }, 500);
            })
            .catch(error => {
                console.error('Erreur de rétrogradation:', error);
                
                // Réactiver le bouton
                if (confirmBtn) {
                    confirmBtn.disabled = false;
                }
                
                // Afficher l'erreur dans le modal
                const infoElement = document.getElementById('userActionModalInfo');
                if (infoElement) {
                    infoElement.className = 'alert alert-danger d-flex align-items-center';
                    infoElement.innerHTML = 
                        '<i class="bi bi-exclamation-triangle-fill me-2 fs-5"></i>' +
                        `<span>Une erreur est survenue lors de la rétrogradation de l'administrateur: ${error.message}</span>`;
                } else {
                    // Fallback si l'élément n'est pas trouvé
                    alert('Une erreur est survenue lors de la rétrogradation de l\'administrateur');
                }
            });
        }
    });
}

// Fonction pour afficher le modal d'action utilisateur
function showUserActionModal(options) {
    // Options par défaut
    const defaultOptions = {
        title: 'Confirmation',
        message: 'Êtes-vous sûr de vouloir effectuer cette action ?',
        infoText: 'Cette action modifiera les données de l\'utilisateur.',
        confirmText: 'Confirmer',
        confirmClass: 'btn-primary',
        confirmIcon: 'bi-check-circle',
        actionCallback: () => {}
    };
    
    // Fusionner les options par défaut avec les options fournies
    const finalOptions = { ...defaultOptions, ...options };
    
    // Vérifier que les éléments du DOM existent avant de les manipuler
    const titleElement = document.getElementById('userActionModalTitle');
    const messageElement = document.getElementById('userActionModalMessage');
    const infoTextElement = document.getElementById('userActionModalInfoText');
    const infoElement = document.getElementById('userActionModalInfo');
    const confirmBtn = document.getElementById('userActionConfirmBtn');
    const confirmBtnText = document.getElementById('userActionConfirmBtnText');
    
    // Mettre à jour les éléments du modal
    if (titleElement) titleElement.textContent = finalOptions.title;
    if (messageElement) messageElement.textContent = finalOptions.message;
    if (infoTextElement) infoTextElement.textContent = finalOptions.infoText;
    if (infoElement) infoElement.className = 'alert alert-info d-flex align-items-center';
    
    if (confirmBtn) {
        confirmBtn.className = `btn ${finalOptions.confirmClass} px-4`;
        confirmBtn.disabled = false;
        
        // S'assurer que le bouton a une icône avant d'essayer de la modifier
        // Si l'icône n'existe pas, on la crée
        let iconElement = confirmBtn.querySelector('i');
        if (!iconElement) {
            iconElement = document.createElement('i');
            iconElement.className = `bi ${finalOptions.confirmIcon} me-2`;
            if (confirmBtnText) {
                confirmBtn.insertBefore(iconElement, confirmBtnText);
            } else {
                confirmBtn.appendChild(iconElement);
            }
        } else {
            iconElement.className = `bi ${finalOptions.confirmIcon} me-2`;
        }
        
        // Supprimer tout gestionnaire d'événements existant
        const newConfirmBtn = confirmBtn.cloneNode(true);
        if (confirmBtn.parentNode) {
            confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        }
    }
    
    if (confirmBtnText) confirmBtnText.textContent = finalOptions.confirmText;
    
    // Ajouter le nouveau gestionnaire d'événements si le bouton existe
    const newBtn = document.getElementById('userActionConfirmBtn');
    if (newBtn) {
        newBtn.addEventListener('click', finalOptions.actionCallback);
    }
    
    // Vérifier que le modal existe avant de l'afficher
    const modalElement = document.getElementById('userActionModal');
    if (modalElement) {
        try {
            const modal = new bootstrap.Modal(modalElement);
            modal.show();
        } catch (error) {
            console.error('Erreur lors de l\'affichage du modal:', error);
            // Afficher un message d'erreur à l'utilisateur
            alert('Une erreur est survenue. Veuillez réessayer ou contacter le support.');
        }
    } else {
        console.error('Le modal #userActionModal n\'existe pas dans le DOM');
        // Fallback à l'alerte native en cas d'absence du modal
        if (confirm(finalOptions.message)) {
            finalOptions.actionCallback();
        }
    }
}

// Fonction pour afficher un toast de succès
function showSuccessToast(message) {
    // Créer un élément div pour le toast
    const toast = document.createElement('div');
    toast.className = 'position-fixed top-0 end-0 p-3 mt-5';
    toast.style.zIndex = '9999';
    
    toast.innerHTML = `
        <div class="toast show bg-white" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="toast-header bg-success text-white">
                <i class="bi bi-check-circle-fill me-2"></i>
                <strong class="me-auto">Succès</strong>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
            <div class="toast-body">
                <div class="d-flex align-items-center">
                    <i class="bi bi-check-circle-fill text-success me-2" style="font-size: 1.5rem;"></i>
                    <span>${message}</span>
                </div>
            </div>
        </div>
    `;
    
    // Ajouter le toast au corps du document
    document.body.appendChild(toast);
    
    // Supprimer le toast après 3 secondes
    setTimeout(() => {
        toast.style.transition = 'opacity 0.5s ease';
        toast.style.opacity = '0';
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 500);
    }, 3000);
}

// Ajouter cette fonction pour identifier les modules spécifiques sans expérience
function identifyModulesWithoutExperience(voeu) {
    const modulesWithoutExperience = [];
    
    // Fonction pour vérifier un module
    const checkModule = (module, semester) => {
        const moduleName = typeof module === 'object' && module.nom ? 
            module.nom : (modulesMap[module] || module);
        
        if (!moduleName) return true; // Ignorer si pas de nom de module
        
        let hasExperience = false;
        const historySemester = semester === 's1' ? 
            voeu.modules_precedents_s1 : voeu.modules_precedents_s2;
        
        if (historySemester && Array.isArray(historySemester)) {
            for (const historyItem of historySemester) {
                if (historyItem.modules && Array.isArray(historyItem.modules)) {
                    for (const historyModule of historyItem.modules) {
                        if (historyModule.nom && areModulesSimilar(historyModule.nom, moduleName)) {
                            hasExperience = true;
                            break;
                        }
                    }
                }
                
                if (hasExperience) break;
            }
        }
        
        if (!hasExperience) {
            modulesWithoutExperience.push({
                name: moduleName,
                semester: semester === 's1' ? 'Semestre 1' : 'Semestre 2'
            });
        }
    };
    
    // Vérifier tous les modules du S1
    if (voeu.choix_s1 && Array.isArray(voeu.choix_s1)) {
        voeu.choix_s1.forEach(choix => {
            if (choix.module) {
                checkModule(choix.module, 's1');
            }
        });
    }
    
    // Vérifier tous les modules du S2
    if (voeu.choix_s2 && Array.isArray(voeu.choix_s2)) {
        voeu.choix_s2.forEach(choix => {
            if (choix.module) {
                checkModule(choix.module, 's2');
            }
        });
    }
    
    return modulesWithoutExperience;
}