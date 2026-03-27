// Fonction pour charger les niveaux depuis l'API
async function chargerNiveaux(selectElement) {
    try {
        const response = await fetch('/api/niveaux');
        const niveaux = await response.json();
        
        // Vider et réinitialiser le select
        selectElement.innerHTML = '<option value="">Sélectionnez un palier</option>';
        
        // Définir l'ordre personnalisé des niveaux
        const ordreNiveaux = ['L1', 'L2', 'L3', 'M1', '4ème année ingénieur', 'M2', '5ème année ingénieur'];
        
        // Trier les niveaux selon l'ordre défini
        niveaux.sort((a, b) => {
            const indexA = ordreNiveaux.indexOf(a.nom);
            const indexB = ordreNiveaux.indexOf(b.nom);
            return indexA - indexB;
        });
        
        // Ajouter les niveaux
        niveaux.forEach(niveau => {
            const option = document.createElement('option');
            option.value = niveau._id;
            option.textContent = niveau.nom;
            selectElement.appendChild(option);
        });
    } catch (error) {
        console.error('Erreur lors du chargement des niveaux:', error);
        showAlert('Erreur lors du chargement des niveaux', 'danger');
    }
}

// Fonction pour charger les spécialités d'un niveau
async function chargerSpecialites(niveauId, selectElement) {
    try {
        const response = await fetch(`/api/specialites/niveau/${niveauId}`);
        const specialites = await response.json();
        
        // Vider et réinitialiser le select
        selectElement.innerHTML = '<option value="">Sélectionnez une spécialité</option>';
        
        // Ajouter les spécialités
        specialites.forEach(specialite => {
            const option = document.createElement('option');
            option.value = specialite._id;
            option.textContent = specialite.nom;
            selectElement.appendChild(option);
        });
    } catch (error) {
        console.error('Erreur lors du chargement des spécialités:', error);
        showAlert('Erreur lors du chargement des spécialités', 'danger');
    }
}

// Fonction pour charger les modules d'une spécialité pour un semestre
async function chargerModules(specialiteId, semestre, selectElement) {
    try {
        const response = await fetch(`/api/modules/specialite/${specialiteId}/semestre/${semestre}`);
        const modules = await response.json();
        
        // Vider et réinitialiser le select
        selectElement.innerHTML = '<option value="">Sélectionnez un module</option>';
        
        // Ajouter les modules
        modules.forEach(module => {
            const option = document.createElement('option');
            option.value = module._id;
            option.textContent = module.nom;
            option.dataset.nature = JSON.stringify(module.nature);
            selectElement.appendChild(option);
        });
    } catch (error) {
        console.error('Erreur lors du chargement des modules:', error);
        showAlert('Erreur lors du chargement des modules', 'danger');
    }
}

// Fonction pour mettre à jour les modules disponibles
async function updateModules(containerId, index) {
    const palierSelect = document.getElementById(`palier_${containerId}_${index}`);
    const specialiteSelect = document.getElementById(`specialite_${containerId}_${index}`);
    const moduleSelect = document.getElementById(`module_${containerId}_${index}`);
    const natureSelect = document.getElementById(`nature_${containerId}_${index}`);
    
    if (!palierSelect.value) {
        specialiteSelect.innerHTML = '<option value="">Sélectionnez d\'abord un palier</option>';
        moduleSelect.innerHTML = '<option value="">Sélectionnez d\'abord une spécialité</option>';
        return;
    }
    
    if (!specialiteSelect.value) {
        moduleSelect.innerHTML = '<option value="">Sélectionnez d\'abord une spécialité</option>';
        return;
    }
    
    // Déterminer le semestre à partir de containerId (s1 ou s2)
    const semestre = containerId === 's1' ? 1 : 2;
    
    // Charger les modules pour la spécialité et le semestre sélectionnés
    await chargerModules(specialiteSelect.value, semestre, moduleSelect);
    
    // Mettre à jour les natures disponibles quand un module est sélectionné
    moduleSelect.addEventListener('change', function() {
        const selectedOption = this.options[this.selectedIndex];
        if (selectedOption.dataset.nature) {
            const natures = JSON.parse(selectedOption.dataset.nature);
            // Mettre à jour les options de nature disponibles
            natureSelect.querySelectorAll('option').forEach(option => {
                option.style.display = natures.includes(option.value) ? '' : 'none';
            });
        }
    });
}

// Fonction pour ajouter un choix dynamiquement
function ajouterChoix(semestre) {
    const container = document.getElementById(`choix-${semestre}-container`);
    const index = container.children.length + 1;
    const div = document.createElement('div');
    div.className = 'module-choice-container';

    div.innerHTML = `
        <div class="module-selection-header">
            <h5 class="mb-0">Choix ${index}</h5>
            <button type="button" class="btn btn-supprimer" onclick="supprimerChoix(this)">
                <i class="bi bi-trash me-1"></i>Supprimer
            </button>
        </div>
        
        <div class="row">
            <div class="col-md-6 mb-3">
                <label for="palier_${semestre}_${index}" class="field-label">Palier :</label>
                <select id="palier_${semestre}_${index}" name="choix_${semestre}[${index-1}][palier]" class="form-select" required>
                    <option value="">Sélectionnez un palier</option>
                </select>
            </div>
            
            <div class="col-md-6 mb-3">
                <label for="specialite_${semestre}_${index}" class="field-label">Spécialité :</label>
                <select id="specialite_${semestre}_${index}" name="choix_${semestre}[${index-1}][specialite]" class="form-select" required>
                    <option value="">Sélectionnez d'abord un palier</option>
                </select>
            </div>
        </div>
        
        <div class="row">
            <div class="col-md-6 mb-3">
                <label for="module_${semestre}_${index}" class="field-label">Module :</label>
                <select id="module_${semestre}_${index}" name="choix_${semestre}[${index-1}][module]" class="form-select" required>
                    <option value="">Sélectionnez d'abord une spécialité</option>
                </select>
            </div>
            
            <div class="col-md-6 mb-3">
                <label for="nature_${semestre}_${index}" class="field-label">Nature :</label>
                <select multiple id="nature_${semestre}_${index}" name="choix_${semestre}[${index-1}][nature][]" class="form-select no-checkmark" required size="3">
                    <option value="Cours">Cours</option>
                    <option value="TD">TD</option>
                    <option value="TP">TP</option>
                </select>
                <small class="nature-help-text"><i class="bi bi-info-circle me-1"></i>Maintenez Ctrl (ou Cmd sur Mac) pour sélectionner plusieurs options</small>
            </div>
        </div>
    `;
    
    container.appendChild(div);
    
    // Initialiser les événements pour le nouveau choix
    const palierSelect = document.getElementById(`palier_${semestre}_${index}`);
    const specialiteSelect = document.getElementById(`specialite_${semestre}_${index}`);
    const moduleSelect = document.getElementById(`module_${semestre}_${index}`);
    
    // Charger les niveaux
    chargerNiveaux(palierSelect);
    
    // Ajouter les événements
    palierSelect.addEventListener('change', async function() {
        console.log(`Palier sélectionné: ${this.value}`);
        await chargerSpecialites(this.value, specialiteSelect);
        if (specialiteSelect.value) {
            const semestreNum = semestre === 's1' ? 1 : 2;
            await chargerModules(specialiteSelect.value, semestreNum, moduleSelect);
        }
    });
    
    specialiteSelect.addEventListener('change', async function() {
        console.log(`Spécialité sélectionnée: ${this.value}`);
        if (this.value) {
            const semestreNum = semestre === 's1' ? 1 : 2;
            await chargerModules(this.value, semestreNum, moduleSelect);
        }
    });
}

// Fonction pour supprimer un choix dynamique
function supprimerChoix(button) {
    // Identifier le conteneur du module et son semestre
    const choixContainer = button.closest('.module-choice-container');
    const semestre = choixContainer.parentElement.id.includes('s1') ? 's1' : 's2';
    
    // Supprimer le choix
    choixContainer.remove();
    
    // Renuméroter les choix restants
    renumberChoices(semestre);
}

// Function to renumber choices after deletion
function renumberChoices(semestre) {
    const container = document.getElementById(`choix-${semestre}-container`);
    const choices = container.querySelectorAll('.module-choice-container');
    
    choices.forEach((choice, index) => {
        // Update title
        const title = choice.querySelector('h5');
        if (title) {
            title.textContent = `Choix ${index + 1}`;
        }
        
        // Update input names
        const inputs = choice.querySelectorAll('select');
        inputs.forEach(input => {
            const name = input.name;
            if (name) {
                input.name = name.replace(/choix_[^[]+\[(\d+)\]/, `choix_${semestre}[${index}]`);
            }
        });
    });
}

// Fonction pour ajouter un module précédemment enseigné
function ajouterModulePrecedent(semestre, annee, indexAnnee) {
    const container = document.getElementById(`modules-precedents-${semestre}-${annee}`);
    const moduleCount = container.children.length;
    
    const newModule = document.createElement('div');
    newModule.className = 'mb-3 module-precedent-item';
    
    newModule.innerHTML = `
        <div class="d-flex align-items-center">
            <div class="flex-grow-1">
                <input type="text" class="form-control mb-2" 
                       name="modules_precedents_${semestre}[${indexAnnee}][modules][${moduleCount}][nom]" 
                       placeholder="Nom du module">
                <input type="text" class="form-control" 
                       name="modules_precedents_${semestre}[${indexAnnee}][modules][${moduleCount}][specialite]" 
                       placeholder="Spécialité">
            </div>
            <button type="button" class="btn btn-sm btn-outline-danger ms-2" 
                    onclick="supprimerModulePrecedent(this)">
                <i class="bi bi-x"></i>
            </button>
        </div>
    `;
    
    container.appendChild(newModule);
}

// Fonction pour supprimer un module précédemment enseigné
function supprimerModulePrecedent(button) {
    const moduleItem = button.closest('.module-precedent-item');
    moduleItem.remove();
}

// Validation du formulaire avant soumission
function validerFormulaire(formData) {
    const champsObligatoires = ['nom', 'email', 'heures_supplementaires'];
    for (const champ of champsObligatoires) {
        if (!formData.get(champ)) {
            alert(`Le champ "${champ}" est obligatoire.`);
            return false;
        }
    }
    return true;
}

// Fonction pour vérifier si l'utilisateur est connecté
function checkAuth() {
    const token = localStorage.getItem('token');
    // Cette fonction ne redirige plus, mais renvoie seulement le statut d'authentification
    return !!token;
}

// Fonction pour obtenir les headers d'authentification
function getAuthHeaders() {
    const token = localStorage.getItem('token');
    
    // Si un token existe, l'ajouter aux en-têtes
    if (token) {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    }
    
    // Sinon, retourner juste le Content-Type
    return {
        'Content-Type': 'application/json'
    };
}

// Fonction pour gérer la déconnexion
function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.reload();
}

// Fonction pour soumettre le formulaire de vœux
async function handleSubmit(event) {
    event.preventDefault();
    try {
        // Récupérer les données du formulaire
        const formData = new FormData(event.target);

        // Récupérer les choix du semestre 1
        const choix_s1 = Array.from(document.querySelectorAll('#choix-s1-container .module-choice-container')).map((choixDiv, idx) => {
            const palierSelect = choixDiv.querySelector('select[name*="palier"]');
            const specialiteSelect = choixDiv.querySelector('select[name*="specialite"]');
            const moduleSelect = choixDiv.querySelector('select[name*="module"]');
            const natureSelect = choixDiv.querySelector('select[name*="nature"]');

            if (!palierSelect || !specialiteSelect || !moduleSelect || !natureSelect) {
                throw new Error(`Veuillez remplir tous les champs pour le choix ${idx + 1} du semestre 1`);
            }

            return {
                palier: palierSelect.value,
                specialite: specialiteSelect.value,
                module: moduleSelect.value,
                nature: Array.from(choixDiv.querySelectorAll('input.nature-checkbox:checked')).map(cb => cb.value)
            };
        });

        // Récupérer les choix du semestre 2
        const choix_s2 = Array.from(document.querySelectorAll('#choix-s2-container .module-choice-container')).map((choixDiv, idx) => {
            const palierSelect = choixDiv.querySelector('select[name*="palier"]');
            const specialiteSelect = choixDiv.querySelector('select[name*="specialite"]');
            const moduleSelect = choixDiv.querySelector('select[name*="module"]');
            const natureSelect = choixDiv.querySelector('select[name*="nature"]');

            if (!palierSelect || !specialiteSelect || !moduleSelect || !natureSelect) {
                throw new Error(`Veuillez remplir tous les champs pour le choix ${idx + 1} du semestre 2`);
            }

            return {
                palier: palierSelect.value,
                specialite: specialiteSelect.value,
                module: moduleSelect.value,
                nature: Array.from(choixDiv.querySelectorAll('input.nature-checkbox:checked')).map(cb => cb.value)
            };
        });
        
        // Récupérer les modules précédents du semestre 1
        const modules_precedents_s1 = [];
        const annees_s1 = ['2024-2025', '2023-2024', '2022-2023'];
        
        annees_s1.forEach((annee, indexAnnee) => {
            const modules = [];
            const moduleItems = document.querySelectorAll(`#modules-precedents-s1-${annee} .mb-3`);
            
            moduleItems.forEach(item => {
                const nomInput = item.querySelector('input[name*="nom"]');
                const specialiteInput = item.querySelector('input[name*="specialite"]');
                
                if (nomInput && nomInput.value.trim() !== '') {
                    modules.push({
                        nom: nomInput.value.trim(),
                        specialite: specialiteInput ? specialiteInput.value.trim() : ''
                    });
                }
            });
            
            if (modules.length > 0) {
                modules_precedents_s1.push({
                    annee: annee,
                    modules: modules
                });
            }
        });
        
        // Récupérer les modules précédents du semestre 2
        const modules_precedents_s2 = [];
        const annees_s2 = ['2024-2025', '2023-2024', '2022-2023'];
        
        annees_s2.forEach((annee, indexAnnee) => {
            const modules = [];
            const moduleItems = document.querySelectorAll(`#modules-precedents-s2-${annee} .mb-3`);
            
            moduleItems.forEach(item => {
                const nomInput = item.querySelector('input[name*="nom"]');
                const specialiteInput = item.querySelector('input[name*="specialite"]');
                
                if (nomInput && nomInput.value.trim() !== '') {
                    modules.push({
                        nom: nomInput.value.trim(),
                        specialite: specialiteInput ? specialiteInput.value.trim() : ''
                    });
                }
            });
            
            if (modules.length > 0) {
                modules_precedents_s2.push({
                    annee: annee,
                    modules: modules
                });
            }
        });

        // Construire l'objet de données complet à envoyer
        const voeuxData = {
            nom: formData.get('nom'),
            email: formData.get('email'),
            telephone: formData.get('telephone'),
            grade: formData.get('grade'),
            bureau: formData.get('bureau'),
            departement: {
                id: formData.get('departement'),
                nom: document.getElementById('departement').options[document.getElementById('departement').selectedIndex].text
            },
            choix_s1: choix_s1,
            choix_s2: choix_s2,
            modules_precedents_s1: modules_precedents_s1,
            modules_precedents_s2: modules_precedents_s2,
            heures_supp_s1: parseFloat(formData.get('heures_supplementaires')) || 0,
            pfe_l3: formData.get('pfe_l3') === 'on',
            commentaires: formData.get('commentaires') || ''
        };

        // Valider et envoyer les données
        if (!validerFormulaire(formData)) {
            return;
        }

        const response = await fetch('/api/voeux', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(voeuxData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Erreur lors de la soumission');
        }

        const result = await response.json();
        
        // Afficher un message de succès
        showAlert('Votre fiche de vœux a été soumise avec succès !', 'success');
        
        // Réinitialiser le formulaire après 2 secondes
        setTimeout(() => {
            document.getElementById('voeuxForm').reset();
        }, 2000);
        
    } catch (error) {
        console.error('Erreur:', error);
        showAlert(`Erreur: ${error.message}`, 'danger');
    }
}

// Fonction pour afficher les messages d'alerte
function showAlert(message, type = 'danger') {
    const alertContainer = document.getElementById('alert-container');
    alertContainer.innerHTML = `
        <div class="alert alert-${type} alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    `;
}

// Fonction pour charger les départements
async function chargerDepartements() {
    try {
        console.log('Début du chargement des départements...');
        const response = await fetch('/api/departements');
        
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        
        const departements = await response.json();
        console.log('Réponse brute des départements:', departements);
        
        if (!Array.isArray(departements)) {
            throw new Error('Les données reçues ne sont pas un tableau');
        }
        
        const selectElement = document.getElementById('departement');
        if (!selectElement) {
            throw new Error('Élément select "departement" non trouvé dans le DOM');
        }
        
        // Vider et réinitialiser le select
        selectElement.innerHTML = '<option value="">Sélectionnez votre département</option>';
        
        // Ajouter les départements
        departements.forEach(departement => {
            if (!departement._id || !departement.Name) {
                console.warn('Département invalide:', departement);
                return;
            }
            
            const option = document.createElement('option');
            option.value = departement._id;
            option.textContent = departement.Name;
            selectElement.appendChild(option);
            console.log('Département ajouté:', departement.Name);
        });

        console.log(`${departements.length} départements chargés avec succès`);
    } catch (error) {
        console.error('Erreur détaillée lors du chargement des départements:', error);
        showAlert(`Erreur lors du chargement des départements: ${error.message}`, 'danger');
    }
}

// Initialiser les événements pour les premiers choix
document.addEventListener('DOMContentLoaded', function() {
    // Ajouter le premier choix pour chaque semestre
    ajouterChoix('s1');
    ajouterChoix('s2');

    // Ajouter l'écouteur d'événements au formulaire
    const form = document.getElementById('voeuxForm');
    if (form) {
        form.addEventListener('submit', handleSubmit);
    }

    // Charger les départements
    chargerDepartements();
});