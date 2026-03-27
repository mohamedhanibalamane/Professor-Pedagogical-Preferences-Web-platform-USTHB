function ajouterModuleSouhait(semestre, annee, index) {
    const container = document.getElementById(`modules-souhaites-${semestre}${annee ? '-' + annee : ''}`);
    const newIndex = container.querySelectorAll('.mb-3').length;
    
    const newModule = document.createElement('div');
    newModule.className = 'mb-3';
    newModule.innerHTML = `
        <div class="icon-input">
            <div class="input-container">
                <i class="bi bi-book-fill"></i>
                <input type="text" class="form-control mb-2" 
                       name="modules_souhaites_${semestre}[${index}][nom]" 
                       placeholder="Nom du module" required>
            </div>
        </div>
        <div class="icon-input">
            <div class="input-container">
                <i class="bi bi-diagram-3-fill"></i>
                <input type="text" class="form-control" 
                       name="modules_souhaites_${semestre}[${index}][specialite]" 
                       placeholder="Spécialité" required>
            </div>
        </div>
    `;
    
    container.appendChild(newModule);
} 