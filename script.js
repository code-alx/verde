// Variáveis globais para instâncias de modais Bootstrap
var rhModalInstance;
var projectModalInstance;
var stepModalInstance; // Modal para etapas de Projetos Prioritários
var daytodayModalInstance; // Modal para demandas Dia a Dia
var daytodayStepModalInstance; // Modal para etapas Dia a Dia
var tooltipInstances = {};

// Array para armazenar os itens de pendência calculados no dashboard
let pendingItemsForUser = [];

// Lista de opções para o campo "Atribuído a" (Projetos e Dia a Dia)
const assignedToOptions = [
    'Núcleo de Expediente',
    'Núcleo de Agronegócios',
    'Nucleo de Regulação e Inovação',
    'Núcleo de Segurança Alimentar',
    'Diretoria de Agronegócios',
    'Secretária Adjunta',
    'Secretário Municipal',
    'Assessor Secretário'
];

// Lista de status para demandas Dia a Dia
const daytodayStatusOptions = [
    'Pendente',
    'Em andamento',
    'Concluído',
    'Cancelado'
];

document.addEventListener('DOMContentLoaded', () => {
    document.documentElement.style.setProperty('--mogi-orange-vibrant-rgb', '243, 156, 18');
    document.documentElement.style.setProperty('--mogi-green-dark-rgb', '106, 163, 60');

    ensureAssignedToOptions();
    initializeUsersWithRoles();

    handleGlobalLogout();
    attachDashboardPendingPanelListeners();

    displayLoggedInUser(); // Exibe usuário logado no header


    const pagePath = window.location.pathname;
    const baseHrefElement = document.querySelector('base');
    const baseHref = baseHrefElement ? baseHrefElement.getAttribute('href') : '/';
    let relativePath = pagePath.startsWith(baseHref) ? pagePath.substring(baseHref.length) : pagePath;
    if (relativePath.startsWith('/')) {
        relativePath = relativePath.substring(1);
    }

    // Lógica de roteamento de página e inicialização
    if (relativePath === 'index.html') {
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', handleLoginForm);
        }
    } else if (relativePath === '' || (relativePath.endsWith('/') && !pagePath.endsWith('index.html') )) {
        // Trata o caso de acesso à raiz do projeto (ex: http://localhost/meuprojeto/)
        // Se não for já 'index.html', redireciona para 'index.html'
        // A condição original era um pouco mais complexa, esta simplificação deve cobrir a maioria dos casos.
        // Se baseHref for '/' e pagePath for '/'), relativePath será ''.
        // Se baseHref for '/app/' e pagePath for '/app/'), relativePath será ''.
        if (relativePath === '' && !pagePath.endsWith('index.html')) {
            window.location.replace(baseHref + 'index.html');
            return; // Importante para evitar que o script continue após o redirecionamento
        } else {
            // Se for a raiz, mas já aponta para index.html (servidor configurado),
            // ou se for um subdiretório (que não é uma página específica do app),
            // apenas prossegue para a verificação de login (se não for a index.html)
            // e inicializadores de página abaixo.
            // No entanto, a lógica abaixo com 'else if' para páginas específicas é mais robusta.
            // Esta branch 'else' para o caminho raiz pode não ser necessária se a index.html
            // for tratada pelo primeiro 'if' e as outras páginas pelo 'else if' subsequente.
        }
    }

    // As condições abaixo serão avaliadas se não for 'index.html' e se não houver redirecionamento.
    if (relativePath.includes('dashboard.html')) {
        checkLoginStatus();
        populateDashboardCards();
    } else if (relativePath.includes('rh_details.html')) {
        checkLoginStatus();
        initializeRhDetailsPage();
        handleUrlHighlight();
    } else if (relativePath.includes('projects_details.html')) {
        checkLoginStatus();
        initializeProjectsDetailsPage();
    } else if (relativePath.includes('assigned_projects.html')) {
        checkLoginStatus();
        initializeAssignedProjectsPage();
        setTimeout(handleUrlHighlight, 250);
    } else if (relativePath.includes('daytoday_details.html')) {
        checkLoginStatus();
        initializeDaytodayDetailsPage();
        setTimeout(handleUrlHighlight, 250);
    } else if (relativePath.includes('completed_demands.html')) {
        checkLoginStatus();
        initializeCompletedDemandsPage();
        setTimeout(handleUrlHighlight, 250);
    } else {
        // Este 'else' é para caminhos que não são 'index.html', não causaram redirecionamento
        // e não correspondem a nenhuma das páginas de detalhes conhecidas.
        // Só chama checkLoginStatus se não for a página de login (index.html),
        // que já foi tratada no primeiro 'if'.
        if (relativePath !== 'index.html' && relativePath !== '') {
            checkLoginStatus();
        }
    }
});

// --- FUNÇÕES GLOBAIS ---

// Exibe o usuário logado no cabeçalho
function displayLoggedInUser() {
     const loggedInUserString = sessionStorage.getItem('loggedInUser');
     const loggedInUser = loggedInUserString ? JSON.parse(loggedInUserString) : null;
     const userDisplayEl = document.getElementById('loggedInUserDisplay');

     if (userDisplayEl) {
         if (loggedInUser && loggedInUser.email) {
             userDisplayEl.textContent = `Logado como: ${loggedInUser.email} (${loggedInUser.role || 'Sem Role'})`;
         } else {
             userDisplayEl.textContent = '';
         }
     }
}


function ensureAssignedToOptions() {
     const storedOptions = getFromLocalStorage('assignedToOptions');
     if (!storedOptions || JSON.stringify(storedOptions) !== JSON.stringify(assignedToOptions)) {
         saveToLocalStorage('assignedToOptions', assignedToOptions);
     }
}


function initializeUsersWithRoles() {
    let users = getFromLocalStorage('users', []);
    const defaultPassword = 'password';

    const userRoleMapping = {
        'expediente@example.com': 'Núcleo de Expediente',
        'agronegocio@example.com': 'Núcleo de Agronegócios',
        'regulacao@example.com': 'Nucleo de Regulação e Inovação',
        'seguranca@example.com': 'Núcleo de Segurança Alimentar',
        'diretoria@example.com': 'Diretoria de Agronegócios',
        'adjunta@example.com': 'Secretária Adjunta',
        'secretario@example.com': 'Secretário Municipal',
        'assessor@example.com': 'Assessor Secretário',
    };

    let usersToSave = [];
    let updatedCount = 0;
    let existingUsersMap = new Map(users.map(user => [user.email, user]));

    Object.keys(userRoleMapping).forEach(email => {
        const role = userRoleMapping[email];
        const existingUser = existingUsersMap.get(email);

        if (!existingUser) {
             usersToSave.push({ email: email, password: defaultPassword, role: role });
             updatedCount++;
        } else {
             if (existingUser.password !== defaultPassword || existingUser.role !== role) {
                 usersToSave.push({ ...existingUser, password: defaultPassword, role: role });
                 updatedCount++;
             } else {
                 usersToSave.push(existingUser);
             }
        }
         existingUsersMap.delete(email);
    });

     existingUsersMap.forEach(user => usersToSave.push(user));
     if(existingUsersMap.size > 0) updatedCount++;


    if (updatedCount > 0 || users.length !== usersToSave.length) {
        saveToLocalStorage('users', usersToSave);
    }
}


function handleGlobalLogout() {
    const logoutLinks = document.querySelectorAll('#logoutLink');
    logoutLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            sessionStorage.removeItem('loggedInUser');
            window.location.href = 'index.html';
        });
    });
}

function checkLoginStatus() {
    const loggedInUserString = sessionStorage.getItem('loggedInUser');
    const loggedInUser = loggedInUserString ? JSON.parse(loggedInUserString) : null;

    const currentPage = window.location.pathname;
    const baseHrefElement = document.querySelector('base');
    const baseHref = baseHrefElement ? baseHrefElement.getAttribute('href') : '/';
    let relativePath = currentPage.startsWith(baseHref) ? currentPage.substring(baseHref.length) : currentPage;
     if (relativePath.startsWith('/')) {
        relativePath = relativePath.substring(1);
    }
    if (relativePath.endsWith('/')) { // Assuming index.html is the default for directories
        const potentialIndex = relativePath + 'index.html';
        // This check is a bit broad; ideally, we only care if it's NOT the login page.
        if (potentialIndex !== 'index.html') { // Avoid infinite loop if base is / and path is /
             relativePath = potentialIndex;
        }
    }


    const isLoginPage = (relativePath === 'index.html' || (relativePath === '' && currentPage.endsWith('/index.html')) || (relativePath === '' && currentPage === baseHref) );


    if (!loggedInUser && !isLoginPage) {
        alert('Você não está logado. Redirecionando para a página de login.');
        window.location.replace(baseHref + 'index.html');
    }
}


function handleLoginForm(event) {
    event.preventDefault(); // Prevent default form submission
    // const loginForm = document.getElementById('loginForm'); // Not strictly needed if event.target is used, but harmless
    // if (!loginForm) return;
    const errorMessageElement = document.getElementById('errorMessage');

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    if (!email || !password) {
        errorMessageElement.textContent = 'Por favor, preencha o email e a senha.';
        return;
    }

    const users = getFromLocalStorage('users', []);
    const user = users.find(u => u.email === email && u.password === password);

    if (user) {
        errorMessageElement.textContent = '';
        sessionStorage.setItem('loggedInUser', JSON.stringify(user));
        window.location.href = 'dashboard.html';
    } else {
        errorMessageElement.textContent = 'Email ou senha inválidos.';
    }
}

function getFromLocalStorage(key, defaultValue = []) {
    const storedValue = localStorage.getItem(key);
    try {
        if (storedValue !== null && storedValue !== undefined && storedValue !== 'null') {
             const parsedValue = JSON.parse(storedValue);
             if (Array.isArray(defaultValue) && !Array.isArray(parsedValue)) {
                 console.warn(`LocalStorage item "${key}" is not an array, returning default.`, storedValue);
                 return defaultValue;
             }
             return parsedValue;
        }
        return defaultValue;
    } catch (e) {
        console.error("Error parsing localStorage item: ", key, storedValue, e);
        return defaultValue;
    }
}


function saveToLocalStorage(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

function ensureTooltip(elementId, titleContent) {
    const element = document.getElementById(elementId);
    if (!element) {
        return;
    }

    let tooltip = bootstrap.Tooltip.getInstance(element);

    if (tooltip) {
        if (typeof tooltip.setContent === 'function') {
            tooltip.setContent({ '.tooltip-inner': titleContent });
        } else {
            element.setAttribute('data-bs-original-title', titleContent);
        }
    } else {
        element.setAttribute('data-bs-toggle', 'tooltip');
        element.setAttribute('data-bs-placement', 'top');
        element.setAttribute('data-bs-html', 'true');
        element.setAttribute('title', titleContent);
        tooltip = new bootstrap.Tooltip(element);
         if (typeof tooltip.setContent === 'function') {
             tooltip.setContent({ '.tooltip-inner': titleContent });
         }
    }
    if (tooltip && typeof tooltip.enable === 'function') {
        tooltip.enable();
    }
}

// Adiciona listeners para o painel de pendências do dashboard
function attachDashboardPendingPanelListeners() {
     const pendingIcon = document.getElementById('pendingAcknowledgments');
     const closeButton = document.getElementById('closePendingPanelBtn');
     const panel = document.getElementById('pendingItemsPanel');
     const list = document.getElementById('pendingItemsList');


     if (pendingIcon) {
         pendingIcon.addEventListener('click', togglePendingItemsPanel);
     }
     if (closeButton) {
         closeButton.addEventListener('click', hidePendingItemsPanel);
     }
     document.addEventListener('click', (event) => {
         if (panel && panel.style.display !== 'none' && !panel.contains(event.target) && (!pendingIcon || !pendingIcon.contains(event.target))) {
              hidePendingItemsPanel();
         }
     });

     if (list) {
         list.addEventListener('click', handlePendingItemClick);
     }
}

// Mostra/esconde o painel de pendências
function togglePendingItemsPanel() {
     const panel = document.getElementById('pendingItemsPanel');
     if (!panel) return;

     if (panel.style.display === 'none' || panel.style.display === '') {
         renderPendingItemsList(); // Render list before showing
         panel.style.display = 'block';
     } else {
         hidePendingItemsPanel();
     }
}

// Esconde o painel de pendências
function hidePendingItemsPanel() {
    const panel = document.getElementById('pendingItemsPanel');
     const list = document.getElementById('pendingItemsList');
    if (panel) {
        panel.style.display = 'none';
    }
     if(list) list.innerHTML = '';
}

// Renderiza a lista de itens de pendência no painel
function renderPendingItemsList() {
     const listEl = document.getElementById('pendingItemsList');
     if (!listEl) return;

     listEl.innerHTML = '';

     if (pendingItemsForUser.length === 0) {
         listEl.innerHTML = '<li class="list-group-item text-muted text-center">Nenhum item aguardando sua ciência.</li>';
         return;
     }

     pendingItemsForUser.sort((a, b) => {
         const typeOrder = {'rh': 1, 'step': 2, 'daytoday': 3};
         if (typeOrder[a.type] !== typeOrder[b.type]) {
             return typeOrder[a.type] - typeOrder[b.type];
         }
         const dateA = a.type === 'rh' ? new Date(a.date) : (a.type === 'step' ? new Date(a.stepDate) : new Date(a.stepDate));
         const dateB = b.type === 'rh' ? new Date(b.date) : (b.type === 'step' ? new Date(b.stepDate) : new Date(b.stepDate));
         return dateA - dateB;
     });


     pendingItemsForUser.forEach(item => {
         const listItem = document.createElement('li');
         listItem.classList.add('list-group-item');
         listItem.setAttribute('data-type', item.type);
         listItem.setAttribute('data-id', item.id);
         if (item.type === 'step') {
             listItem.setAttribute('data-project-id', item.projectId);
         } else if (item.type === 'daytoday') {
              listItem.setAttribute('data-demand-id', item.demandId);
         }


         const itemDate = item.type === 'rh' ? new Date(item.date) : (item.type === 'step' ? new Date(item.stepDate) : new Date(item.stepDate));
         const displayDate = itemDate ? itemDate.toLocaleDateString('pt-BR') : 'Data não informada';

         listItem.innerHTML = `
             <div class="list-group-item-content">
                 <strong>${item.displayTitle}</strong>
                 <span>${item.description} (${displayDate})</span>
             </div>
             <div class="list-group-item-actions">
                 <button class="btn btn-ciencia btn-ciencia-pending btn-sm" data-type="${item.type}" data-id="${item.id}" ${item.type === 'step' ? `data-project-id="${item.projectId}"` : ''} ${item.type === 'daytoday' ? `data-demand-id="${item.demandId}"` : ''}>
                     <i class="bi bi-exclamation-triangle-fill"></i> Ciência
                 </button>
             </div>
         `;
         listEl.appendChild(listItem);
     });
}

// Lida com cliques nos itens do painel de pendências
function handlePendingItemClick(event) {
     const target = event.target;

     const cienciaButton = target.closest('.btn-ciencia');
     if (cienciaButton) {
         event.stopPropagation();
         const type = cienciaButton.dataset.type;
         const id = cienciaButton.dataset.id;
         if (type === 'rh') {
             handleAcknowledgeRhDemand(id);
         } else if (type === 'step') {
             const projectId = cienciaButton.dataset.projectId;
             handleAcknowledgeStep(projectId, id);
         } else if (type === 'daytoday') {
              const demandId = cienciaButton.dataset.demandId;
              handleAcknowledgeDaytodayStep(demandId, id);
         }
         return;
     }

     const listItem = target.closest('.list-group-item');
     if (listItem) {
         const type = listItem.dataset.type;
         const id = listItem.dataset.id;

         hidePendingItemsPanel();

         if (type === 'rh') {
             window.location.href = `rh_details.html#demandId=${id}`;
         } else if (type === 'step') {
             const projectId = listItem.dataset.projectId;
             window.location.href = `assigned_projects.html#projectId=${projectId}&stepId=${id}`;
         } else if (type === 'daytoday') {
              const demandId = listItem.dataset.demandId;
              const demands = getFromLocalStorage('daytoday_demands');
              const demand = demands.find(d => d.id === demandId);
              const page = (demand && demand.status === 'Concluído') ? 'completed_demands.html' : 'daytoday_details.html';
              window.location.href = `${page}#demandId=${demandId}&stepId=${id}`;
         }
     }
}

// Verifica o fragmento do URL ao carregar páginas de detalhes
function handleUrlHighlight() {
     const hash = window.location.hash;
     if (!hash) return;

     const params = new URLSearchParams(hash.substring(1));
     const demandIdFromUrl = params.get('demandId');
     const projectIdFromUrl = params.get('projectId');
     const stepIdFromUrl = params.get('stepId');

     const currentPage = window.location.pathname;
     const baseHrefElement = document.querySelector('base');
     const baseHref = baseHrefElement ? baseHrefElement.getAttribute('href') : '/';
     let relativePath = currentPage.startsWith(baseHref) ? currentPage.substring(baseHref.length) : currentPage;
      if (relativePath.startsWith('/')) relativePath = relativePath.substring(1);
      if (relativePath.endsWith('/')) relativePath += 'index.html';


     setTimeout(() => {
         if (relativePath.includes('rh_details.html') && demandIdFromUrl) {
             highlightRhDemand(demandIdFromUrl);
         } else if (relativePath.includes('assigned_projects.html') && projectIdFromUrl && stepIdFromUrl) {
             toggleProjectDetails(projectIdFromUrl);
             setTimeout(() => {
                 highlightProjectStep(stepIdFromUrl);
             }, 100);
         } else if ((relativePath.includes('daytoday_details.html') || relativePath.includes('completed_demands.html')) && demandIdFromUrl) {
              highlightDaytodayDemand(demandIdFromUrl);
              if (stepIdFromUrl) {
                  toggleDaytodayDetails(demandIdFromUrl);
                  setTimeout(() => {
                       highlightDaytodayStep(stepIdFromUrl);
                  }, 100);
              }
         }

     }, 200);
}

// Destaca uma demanda RH
function highlightRhDemand(demandId) {
     const demandElement = document.querySelector(`#allRhDemandsList li.list-group-item[data-id="${demandId}"]`);
     if (demandElement) {
         demandElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
         demandElement.classList.add('item-highlight');
         setTimeout(() => {
             demandElement.classList.remove('item-highlight');
         }, 2000);
     } else {
         console.warn("Demanda RH não encontrada para destacar:", demandId);
     }
}

// Destaca uma etapa de projeto
function highlightProjectStep(stepId) {
    const stepElement = document.querySelector(`.step-list li.step-item[data-step-id="${stepId}"]`);
     if (stepElement) {
         stepElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
         stepElement.classList.add('item-highlight');
         setTimeout(() => {
             stepElement.classList.remove('item-highlight');
         }, 2000);
     } else {
         console.warn("Etapa do projeto não encontrada para destacar:", stepId);
     }
}

// Destaca uma demanda Dia a Dia (item da lista principal)
function highlightDaytodayDemand(demandId) {
     const demandElement = document.querySelector(`.daytoday-demand-list li.list-group-item[data-id="${demandId}"]`);
     if (demandElement) {
         demandElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
         demandElement.classList.add('item-highlight');
         setTimeout(() => {
             demandElement.classList.remove('item-highlight');
         }, 2000);
     } else {
         console.warn("Demanda Dia a Dia não encontrada para destacar:", demandId);
     }
}

// Destaca uma etapa de demanda Dia a Dia (item da sublista)
function highlightDaytodayStep(stepId) {
     const stepElement = document.querySelector(`.daytoday-step-details .daytoday-step-list li.daytoday-step-item[data-id="${stepId}"]`);
     if (stepElement) {
         stepElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
         stepElement.classList.add('item-highlight');
         setTimeout(() => {
             stepElement.classList.remove('item-highlight');
         }, 2000);
     } else {
         console.warn("Etapa de Demanda Dia a Dia não encontrada para destacar:", stepId);
     }
}


// --- DASHBOARD (dashboard.html) ---
function populateDashboardCards() {
    // **CORRIGIDO:** Ensure logged-in user is loaded before proceeding with user-specific filtering/counts
     const loggedInUserString = sessionStorage.getItem('loggedInUser');
     const loggedInUser = loggedInUserString ? JSON.parse(loggedInUserString) : null;
     const userEmail = loggedInUser ? loggedInUser.email : null;
     const userRole = loggedInUser ? loggedInUser.role : null;

     // If not logged in, clear user-specific cards and pending counts and exit
     if (!loggedInUser || !userEmail || !userRole) {
          const assignedProjectsCardTitleEl = document.getElementById('assignedProjectsCardTitle');
          const assignedProjectsCardBodyEl = document.getElementById('assignedProjectsCardBody');
          if (assignedProjectsCardTitleEl) assignedProjectsCardTitleEl.textContent = 'Projetos Atribuídos (Login Necessário)';
          if (assignedProjectsCardBodyEl) assignedProjectsCardBodyEl.innerHTML = '<p class="card-text text-muted">Faça login para ver seus projetos atribuídos.</p>';

          const daytodayCardBodyEl = document.getElementById('daytodayCardBody');
          const daytodayCardPendingScienceEl = document.getElementById('daytodayCardPendingScience');
          const daytodayCardPendingCountEl = document.getElementById('daytodayCardPendingCount');
          if(daytodayCardBodyEl) daytodayCardBodyEl.innerHTML = '<p class="card-text text-muted">Carregando demandas...</p>'; // Reset or empty
          if(daytodayCardPendingCountEl) daytodayCardPendingCountEl.textContent = 0;
          if(daytodayCardPendingScienceEl) daytodayCardPendingScienceEl.style.display = 'none';

          const rhCardPendingScienceEl = document.getElementById('rhCardPendingScience');
          if(rhCardPendingScienceEl) rhCardPendingScienceEl.style.display = 'none';
          const projectCardPendingScienceEl = document.getElementById('projectCardPendingScience');
          if(projectCardPendingScienceEl) projectCardPendingScienceEl.style.display = 'none';


          updatePendingCount(0); // Update GLOBAL pending count
          return; // Exit if not logged in
     }


    const projects = getFromLocalStorage('projects').map(p => {
         if (!p.steps) p.steps = [];
         p.steps = p.steps.map(step => {
             if (!step.acknowledgedBy) step.acknowledgedBy = {};
             return step;
         });
         return p;
    });
     const rhDemands = getFromLocalStorage('rh_demands').map(d => {
         if (!d.acknowledgedBy) d.acknowledgedBy = {};
         return d;
    });
     const daytodayDemands = getFromLocalStorage('daytoday_demands').map(d => {
         if (!d.acknowledgedBy) d.acknowledgedBy = {};
         if (!d.steps) d.steps = [];
         d.steps = d.steps.map(step => {
              if (!step.acknowledgedBy) step.acknowledgedBy = {};
              if (!step.files) step.files = {};
              return step;
         });
         return d;
    });

    // --- Demandas de RH Resumo ---
    let feriasCount = 0;
    let feriasDetails = [];
    let abonosCount = 0;
    let abonosDetails = [];
    const today = new Date(); today.setHours(0,0,0,0);
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const fifteenDaysFromNow = new Date(); fifteenDaysFromNow.setDate(today.getDate() + 15); fifteenDaysFromNow.setHours(23,59,59,999);

    rhDemands.forEach(demand => {
        const demandStartDate = new Date(demand.startDate + 'T00:00:00');
        const demandEndDate = new Date(demand.endDate + 'T00:00:00');
        const displayStart = demandStartDate.toLocaleDateString('pt-BR');
        const displayEnd = demandEndDate.toLocaleDateString('pt-BR');
        if (demand.type === 'ferias') {
             if (
                (demandStartDate.getMonth() === currentMonth && demandStartDate.getFullYear() === currentYear) ||
                (demandEndDate.getMonth() === currentMonth && demandEndDate.getFullYear() === currentYear) ||
                (demandStartDate < new Date(currentYear, currentMonth, 1) && demandEndDate > new Date(currentYear, currentMonth + 1, 0))
             ) {
                feriasCount++;
                feriasDetails.push(`${demand.name} (${displayStart} - ${displayEnd})`);
            }
        } else if (demand.type === 'abono') {
             const isWithinPeriod = (date) => date >= today && date <= fifteenDaysFromNow;
             if (isWithinPeriod(demandStartDate) || isWithinPeriod(demandEndDate) || (demandStartDate < today && demandEndDate > fifteenDaysFromNow)) {
                abonosCount++;
                abonosDetails.push(`${demand.name} (${displayStart} - ${displayEnd})`);
            }
        }
    });
    const feriasCountEl = document.getElementById('feriasCount');
    if(feriasCountEl) {
        feriasCountEl.textContent = feriasCount;
        ensureTooltip('feriasCount', feriasDetails.length > 0 ? feriasDetails.join('<br>') : 'Nenhum funcionário em férias este mês.');
    }

    const abonosCountEl = document.getElementById('abonosCount');
     if(abonosCountEl) {
        abonosCountEl.textContent = abonosCount;
        ensureTooltip('abonosCount', abonosDetails.length > 0 ? abonosDetails.join('<br>') : 'Nenhum funcionário abonando nos próximos 15 dias.');
    }


    // --- Projetos (Matriz com Totais) ---
    const matrix = {
        Pendente: { Baixa: { count: 0, details: [] }, Média: { count: 0, details: [] }, Alta: { count: 0, details: [] }, Total: 0 },
        'Em andamento': { Baixa: { count: 0, details: [] }, Média: { count: 0, details: [] }, Alta: { count: 0, details: [] }, Total: 0 },
        Concluído: { Baixa: { count: 0, details: [] }, Média: { count: 0, details: [] }, Alta: { count: 0, details: [] }, Total: 0 }
    };
    const colTotals = { Baixa: 0, Média: 0, Alta: 0 };
    let projGrandTotal = 0;


    const statusToIdPartMap = { 'Pendente': 'pendente', 'Em andamento': 'andamento', 'Concluído': 'concluido' };
    const priorityToIdPartMap = { 'Baixa': 'baixa', 'Média': 'media', 'Alta': 'alta' };

    projects.forEach(project => {
        const status = project.status;
        const priority = project.priority;

        if (matrix[status] && matrix[status][priority]) {
            const currentCell = matrix[status][priority];
            currentCell.count++;
            currentCell.details.push(`[${project.assignedTo || 'Não atribuído'}] ${project.description}`);
            matrix[status].Total++;
            colTotals[priority]++;
            projGrandTotal++;
        } else {
            console.warn(`Projeto com status "${status}" ou prioridade "${priority}" inválida ignorado na matriz:`, project);
        }
    });

     document.querySelectorAll('.project-summary-table [data-bs-toggle="tooltip"]').forEach(el => {
         const tooltip = bootstrap.Tooltip.getInstance(el);
         if(tooltip) tooltip.dispose();
     });


    for (const status in matrix) {
        const statusIdPart = statusToIdPartMap[status];
        if (!statusIdPart) continue;

        for (const priority in matrix[status]) {
            if (priority === 'Total') continue;
            const cellData = matrix[status][priority];
            const priorityIdPart = priorityToIdPartMap[priority];
            if (!priorityIdPart) continue;

            const cellId = `proj-${statusIdPart}-${priorityIdPart}`;
            const cellElement = document.getElementById(cellId);
            if (cellElement) {
                cellElement.textContent = cellData.count;
                ensureTooltip(cellId, cellData.details.length > 0 ? cellData.details.join('<br>') : `Nenhum projeto ${status.toLowerCase()} com prioridade ${priority.toLowerCase()}.`);
            } else {
                // console.warn(`Elemento com ID ${cellId} não encontrado.`);
            }
        }
        const rowTotalCellId = `proj-${statusIdPart}-total`;
        const rowTotalCellElement = document.getElementById(rowTotalCellId);
         if (rowTotalCellElement) {
            rowTotalCellElement.textContent = matrix[status].Total;
             ensureTooltip(rowTotalCellId, `Total de projetos ${status.toLowerCase()}`);
         } else {
             // console.warn(`Elemento com ID ${rowTotalCellId} não encontrado.`);
         }
    }

    for (const priority in colTotals) {
        const priorityIdPart = priorityToIdPartMap[priority];
        if (!priorityIdPart) continue;
        const colTotalCellId = `proj-total-${priorityIdPart}`;
        const colTotalCellElement = document.getElementById(colTotalCellId);
        if (colTotalCellElement) {
            colTotalCellElement.textContent = colTotals[priority];
            ensureTooltip(colTotalCellId, `Total de projetos com prioridade ${priority.toLowerCase()}`);
        } else {
             // console.warn(`Elemento com ID ${colTotalCellId} não encontrado.`);
        }
    }
    const grandTotalCellElement = document.getElementById('proj-grand-total');
    if (grandTotalCellElement) {
        grandTotalCellElement.textContent = projGrandTotal;
        ensureTooltip('proj-grand-total', `Total geral de ${projGrandTotal} projetos.`);
    } else {
         // console.warn(`Elemento com ID proj-grand-total não encontrado.`);
    }

    // --- Demandas do Dia a Dia Resumo (Ativas) no Card ---
    const daytodayCardBodyEl = document.getElementById('daytodayCardBody');
    const daytodayCardPendingScienceEl = document.getElementById('daytodayCardPendingScience');
    const daytodayCardPendingCountEl = document.getElementById('daytodayCardPendingCount');

     // Declare demandsToShowInCard here, initialized as an empty array
     let demandsToShowInCard = []; // <<< ALTERAÇÃO APLICADA: Declarado aqui com let

     // Reset pending items list and count (GLOBAL)
     pendingItemsForUser = [];
     let globalPendingCount = 0;

     // Calculate Day to Day card specific pending count and list
     let daytodayCardPendingCount = 0;
     const activeDaytodayDemands = daytodayDemands.filter(d => d.status !== 'Concluído');

    if(daytodayCardBodyEl && daytodayCardPendingScienceEl && daytodayCardPendingCountEl) {
        daytodayCardBodyEl.innerHTML = '';

        if (activeDaytodayDemands.length === 0) {
             daytodayCardBodyEl.innerHTML = '<p class="card-text text-muted">Nenhuma demanda ativa registrada.</p>';
             daytodayCardPendingCountEl.textContent = 0;
             daytodayCardPendingScienceEl.style.display = 'none';
        } else {
             const daytodayList = document.createElement('ul');
             daytodayList.classList.add('dashboard-daytoday-list');

              const statusOrderDaytoday = {'Pendente': 1, 'Em andamento': 2, 'Cancelado': 3};
              activeDaytodayDemands.sort((a, b) => {
                  const statusDiff = statusOrderDaytoday[a.status] - statusOrderDaytoday[b.status];
                  if (statusDiff !== 0) return statusDiff;
                  return new Date(a.inclusionDate) - new Date(b.inclusionDate); // Oldest first
              });

             // Assign demandsToShowInCard inside the if block
             demandsToShowInCard = activeDaytodayDemands.slice(0, 10); // <<< ALTERAÇÃO APLICADA: Atribuído (sem const)


             demandsToShowInCard.forEach(demand => {
                 const listItem = document.createElement('li');
                 const displayInclusionDate = demand.inclusionDate ? new Date(demand.inclusionDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'Data não informada';
                 const assignedRole = demand.assignedToRole || 'Não atribuído';

                 // Check for science on STEPS within this demand for the logged-in user
                 let demandHasPendingStepsForUser = false;
                 if (demand.steps) {
                     demand.steps.forEach(step => {
                         if (!step.acknowledgedBy?.[userEmail]) {
                              demandHasPendingStepsForUser = true;
                             // Collect this step for the GLOBAL pending list
                             globalPendingCount++;
                             pendingItemsForUser.push({
                                 type: 'daytoday', // Daytoday Step
                                 id: step.id,
                                 demandId: demand.id,
                                 description: `${step.description}`,
                                 displayTitle: `Dia a Dia: ${demand.description.substring(0, 30)}... - Etapa`,
                                 stepDate: step.date
                             });
                         }
                     });
                 }

                 // Count for the CARD indicator: demands where the user's role is assigned
                 // AND it has steps that need their science.
                 if (userRole && demand.assignedToRole === userRole && demandHasPendingStepsForUser) {
                      daytodayCardPendingCount++;
                 }


                 listItem.innerHTML = `
                     <div class="demand-info">
                         <strong>${demand.description || 'Sem descrição'}</strong>
                         <span>(${displayInclusionDate})</span>
                         <span>${assignedRole}</span>
                     </div>
                     <span class="badge bg-status-${normalizeClassName(demand.status)}">${demand.status}</span>
                 `;
                 daytodayList.appendChild(listItem);
             });

            daytodayCardBodyEl.appendChild(daytodayList);

             daytodayCardPendingCountEl.textContent = daytodayCardPendingCount;
             if (daytodayCardPendingCount > 0) {
                  daytodayCardPendingScienceEl.style.display = 'inline-block';
                  daytodayCardPendingScienceEl.classList.add('text-warning');
             } else {
                  daytodayCardPendingScienceEl.style.display = 'none';
             }
        }


        // Collect pending science for RH Demands for this user (GLOBAL count)
         let rhPendingCount = 0;
         rhDemands.forEach(demand => {
             if (!demand.acknowledgedBy?.[userEmail]) {
                 globalPendingCount++;
                 rhPendingCount++;
                 const typeText = demand.type === 'ferias' ? 'Férias' : 'Abono';
                 pendingItemsForUser.push({
                     type: 'rh',
                     id: demand.id,
                     description: `${demand.name} (${typeText}) - ${new Date(demand.startDate + 'T00:00:00').toLocaleDateString('pt-BR')}`,
                     displayTitle: `RH: ${demand.name}`,
                     date: demand.startDate
                 });
             }
         });
         // Update RH card pending indicator
          const rhCardPendingScienceEl = document.getElementById('rhCardPendingScience');
          const rhCardPendingCountEl = document.getElementById('rhCardPendingCount');
          if(rhCardPendingScienceEl && rhCardPendingCountEl) {
              rhCardPendingCountEl.textContent = rhPendingCount;
              if (rhPendingCount > 0) {
                  rhCardPendingScienceEl.style.display = 'inline-block';
                  rhCardPendingScienceEl.classList.add('text-warning');
              } else {
                  rhCardPendingScienceEl.style.display = 'none';
              }
          }


         // Collect pending science for Project Steps for this user (GLOBAL count)
         let projectPendingCount = 0;
         projects.forEach(project => {
              if (project.steps) {
                  project.steps.forEach(step => {
                      if (!step.acknowledgedBy?.[userEmail]) {
                           globalPendingCount++;
                           projectPendingCount++;
                           pendingItemsForUser.push({
                               type: 'step', // Project Step
                               id: step.id,
                               projectId: project.id,
                               description: `${step.description}`,
                               displayTitle: `Proj ${project.orderIndex}: ${project.description.substring(0, 30)}... - Etapa`,
                               stepDate: step.date
                           });
                      }
                  });
              }
         });
         // Update Project card pending indicator
          const projectCardPendingScienceEl = document.getElementById('projectCardPendingScience');
          const projectCardPendingCountEl = document.getElementById('projectCardPendingCount');
          if(projectCardPendingScienceEl && projectCardPendingCountEl) {
               projectCardPendingCountEl.textContent = projectPendingCount;
              if (projectPendingCount > 0) {
                  projectCardPendingScienceEl.style.display = 'inline-block';
                  projectCardPendingScienceEl.classList.add('text-warning');
              } else {
                  projectCardPendingScienceEl.style.display = 'none';
              }
          }


         // Collect pending science for Day to Day Steps for this user (GLOBAL count)
         // Collect steps from demands that were NOT in demandsToShowInCard (if any)
         const activeDaytodayDemandsNotInCard = activeDaytodayDemands.filter(d => !demandsToShowInCard.some(cardD => cardD.id === d.id));
         // Collect steps from *completed* demands.
         const completedDaytodayDemands = daytodayDemands.filter(d => d.status === 'Concluído');

         activeDaytodayDemandsNotInCard.forEach(demand => {
              if (demand.steps) {
                  demand.steps.forEach(step => {
                      if (!step.acknowledgedBy?.[userEmail]) {
                          globalPendingCount++;
                           pendingItemsForUser.push({
                               type: 'daytoday',
                               id: step.id,
                               demandId: demand.id,
                               description: `${step.description}`,
                               displayTitle: `Dia a Dia: ${demand.description.substring(0, 30)}... - Etapa`,
                               stepDate: step.date
                           });
                      }
                  });
              }
         });

         completedDaytodayDemands.forEach(demand => {
              if (demand.steps) {
                  demand.steps.forEach(step => {
                      if (!step.acknowledgedBy?.[userEmail]) {
                          globalPendingCount++;
                           pendingItemsForUser.push({
                               type: 'daytoday',
                               id: step.id,
                               demandId: demand.id,
                               description: `${step.description}`,
                               displayTitle: `Dia a Dia: ${demand.description.substring(0, 30)}... - Etapa (Concluída)`,
                               stepDate: step.date
                           });
                      }
                  });
              }
         });


         updatePendingCount(globalPendingCount);

    } else {
         updatePendingCount(0);
         if(daytodayCardPendingScienceEl) daytodayCardPendingScienceEl.style.display = 'none';
         const rhCardPendingScienceEl = document.getElementById('rhCardPendingScience');
         if(rhCardPendingScienceEl) rhCardPendingScienceEl.style.display = 'none';
         const projectCardPendingScienceEl = document.getElementById('projectCardPendingScience');
         if(projectCardPendingScienceEl) projectCardPendingScienceEl.style.display = 'none';
    }

    // --- Projetos Atribuídos ao Usuário Logado (Card) ---
    const assignedProjectsCardBodyEl = document.getElementById('assignedProjectsCardBody');
    const assignedProjectsCardTitleEl = document.getElementById('assignedProjectsCardTitle');

    if (assignedProjectsCardBodyEl && assignedProjectsCardTitleEl) {
         if (!loggedInUser || !loggedInUser.role) {
             // Handled at the beginning of the function
             return;
         }

        const userRole = loggedInUser.role;
        assignedProjectsCardTitleEl.textContent = `Projetos Atribuídos a: ${userRole}`;

        // Filter projects by the logged-in user's role
        const assignedProjects = projects.filter(project => project.assignedTo === userRole);

        assignedProjectsCardBodyEl.innerHTML = ''; // Clear previous content

        if (assignedProjects.length === 0) {
            assignedProjectsCardBodyEl.innerHTML = `<p class="card-text text-muted">Nenhum projeto atribuído a "${userRole}" no momento.</p>`;
        } else {
             const assignedList = document.createElement('ul');
             assignedList.classList.add('assigned-project-list');

             const priorityOrderMapDisplay = { 'Alta': 1, 'Média': 2, 'Baixa': 3};
             assignedProjects.sort((a, b) => {
                 const statusOrder = {'Pendente': 1, 'Em andamento': 2, 'Concluído': 3};
                 const statusDiff = statusOrder[a.status] - statusOrder[b.status];
                 if (statusDiff !== 0) return statusDiff;

                 const priorityDiff = priorityOrderMapDisplay[a.priority] - priorityOrderMapDisplay[b.priority];
                 if (priorityDiff !== 0) return priorityDiff;

                 return a.description.localeCompare(b.description);
             });


            assignedProjects.forEach(project => {
                 updateProjectLastStepInfo(project);

                const listItem = document.createElement('li');
                 listItem.innerHTML = `
                     <div class="project-info">
                         <strong>${project.description}</strong>
                         <div class="project-details">
                              <span><i class="bi bi-calendar-event"></i> ${project.lastModified || 'Sem etapas'}</span>
                              <span><i class="bi bi-geo-alt"></i> ${project.location || 'Sem etapas'}</span>
                         </div>
                     </div>
                     <span class="badge bg-status-${normalizeClassName(project.status)}">${project.status}</span>
                 `;
                 assignedList.appendChild(listItem);
             });

             assignedProjectsCardBodyEl.appendChild(assignedList); // Append the populated list
        }
    } else {
        console.warn("Elementos do card de projetos atribuídos não encontrados no dashboard.");
    }
}


// Atualiza a contagem de pendências no dashboard (GLOBAL)
function updatePendingCount(count) {
     const pendingCountEl = document.getElementById('pendingCount');
     const pendingAcknowledgmentsEl = document.getElementById('pendingAcknowledgments');

     if (pendingCountEl) {
         pendingCountEl.textContent = count;
     }
     if (pendingAcknowledgmentsEl) {
          if (count > 0) {
              pendingAcknowledgmentsEl.style.display = 'flex';
              pendingAcknowledgmentsEl.classList.add('text-warning');
          } else {
              pendingAcknowledgmentsEl.style.display = 'none';
          }
     }
}


// --- DETALHES DE RH ---
function initializeRhDetailsPage() {
    const rhModalEl = document.getElementById('rhModal');
    if (rhModalEl) {
        rhModalInstance = new bootstrap.Modal(rhModalEl);
        rhModalEl.addEventListener('hidden.bs.modal', () => {
            document.getElementById('rhDemandForm').reset();
            document.getElementById('demandId').value = '';
            document.getElementById('rhModalLabel').textContent = 'Adicionar/Editar Demanda de RH';
        });
    }

    const rhDemandForm = document.getElementById('rhDemandForm');
    if(rhDemandForm) rhDemandForm.addEventListener('submit', handleRhDemandSubmit);

    const addRhDemandBtn = document.getElementById('addRhDemandBtn');
    if (addRhDemandBtn) {
        addRhDemandBtn.addEventListener('click', () => {
            document.getElementById('rhDemandForm').reset();
            document.getElementById('demandId').value = '';
            document.getElementById('rhModalLabel').textContent = 'Adicionar Demanda de RH';
        });
    }

    renderRhLists();
     const rhDemandListEl = document.getElementById('allRhDemandsList');
     if(rhDemandListEl && !rhDemandListEl.dataset.listenersAttached) {
         rhDemandListEl.addEventListener('click', (event) => {
              const cienciaButton = event.target.closest('.btn-ciencia');
              const editButton = event.target.closest('.edit-btn');
              const deleteButton = event.target.closest('.delete-btn');

              if (cienciaButton) {
                  event.preventDefault();
                  event.stopPropagation();
                  const demandId = cienciaButton.dataset.id;
                  handleAcknowledgeRhDemand(demandId);
              } else if (editButton) {
                  event.preventDefault();
                  event.stopPropagation();
                  openRhModalForEdit(editButton.dataset.id);
              } else if (deleteButton) {
                   event.preventDefault();
                   event.stopPropagation();
                   deleteRhDemand(deleteButton.dataset.id);
              }
         });
          rhDemandListEl.dataset.listenersAttached = 'true';
     }

     handleUrlHighlight();
}

function handleRhDemandSubmit(event) {
    event.preventDefault();
    const id = document.getElementById('demandId').value;
    const employeeName = document.getElementById('employeeName').value.trim();
    const demandType = document.getElementById('demandType').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    if (!employeeName || !startDate || !endDate) {
        alert('Por favor, preencha todos os campos obrigatórios.');
        return;
    }
    if (new Date(endDate) < new Date(startDate)) {
        alert('A data de fim não pode ser anterior à data de início.');
        return;
    }

    let demands = getFromLocalStorage('rh_demands');
    if (id) {
        const index = demands.findIndex(d => d.id === id);
        if (index > -1) {
             demands[index] = { ...demands[index], name: employeeName, type: demandType, startDate, endDate };
             if (!demands[index].acknowledgedBy) demands[index].acknowledgedBy = {};
        } else {
             console.error("Demanda RH não encontrada para edição:", id);
             alert("Erro ao salvar demanda RH.");
             return;
        }
    } else {
        const newDemand = {
            id: Date.now().toString(),
            name: employeeName,
            type: demandType,
            startDate,
            endDate,
            acknowledgedBy: {}
        };
        demands.push(newDemand);
    }
    saveToLocalStorage('rh_demands', demands);
    renderRhLists();
    populateDashboardCards();
    if (rhModalInstance) rhModalInstance.hide();
}

function renderRhLists() {
    const demands = getFromLocalStorage('rh_demands');
    const feriasListEl = document.getElementById('feriasList');
    const abonosListEl = document.getElementById('abonosList');
    const allRhDemandsListEl = document.getElementById('allRhDemandsList');

    if(feriasListEl) feriasListEl.innerHTML = '';
    if(abonosListEl) abonosListEl.innerHTML = '';
    if(allRhDemandsListEl) allRhDemandsListEl.innerHTML = '';


    const today = new Date(); today.setHours(0,0,0,0);
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const fifteenDaysFromNow = new Date(); fifteenDaysFromNow.setDate(today.getDate() + 15); fifteenDaysFromNow.setHours(23,59,59,999);

     const loggedInUserString = sessionStorage.getItem('loggedInUser');
     const loggedInUser = loggedInUserString ? JSON.parse(loggedInUserString) : null;
     const userEmail = loggedInUser ? loggedInUser.email : null;


    if (demands.length === 0) {
        const emptyMsg = '<li class="list-group-item text-muted">Nenhuma demanda registrada.</li>';
        if(feriasListEl) feriasListEl.innerHTML = emptyMsg;
        if(abonosListEl) abonosListEl.innerHTML = emptyMsg;
        if(allRhDemandsListEl) allRhDemandsListEl.innerHTML = emptyMsg;
        return;
    }

    let hasFerias = false, hasAbonos = false;
    demands.sort((a,b) => new Date(a.startDate) - new Date(b.startDate));

    demands.forEach(demand => {
         if (!demand.acknowledgedBy) demand.acknowledgedBy = {};

        const displayStartDate = new Date(demand.startDate + 'T00:00:00').toLocaleDateString('pt-BR');
        const displayEndDate = new Date(demand.endDate + 'T00:00:00').toLocaleDateString('pt-BR');
        const typeText = demand.type === 'ferias' ? 'Férias' : 'Abono';
        const listItemContentText = `${demand.name} (${typeText}) - ${displayStartDate} a ${displayEndDate}`;

        if(allRhDemandsListEl) {
            const generalLi = document.createElement('li');
            generalLi.className = 'list-group-item d-flex justify-content-between align-items-center';
             generalLi.setAttribute('data-id', demand.id);


             const isAcknowledged = userEmail && demand.acknowledgedBy[userEmail] === true;
             const cienciaButtonClass = isAcknowledged ? 'btn-ciencia-acknowledged' : 'btn-ciencia-pending';
             const cienciaButtonText = isAcknowledged ? 'Ciente' : 'Dar Ciência';
             const cienciaButtonIcon = isAcknowledged ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill';

            generalLi.innerHTML = `
                <span>${listItemContentText}</span>
                <div class="rh-actions btn-group btn-group-sm">
                     ${userEmail ? `<button class="btn btn-ciencia ${cienciaButtonClass}" data-id="${demand.id}" data-type="rh"><i class="bi ${cienciaButtonIcon}"></i> ${cienciaButtonText}</button>` : ''}
                    <button class="btn btn-outline-primary edit-btn" data-id="${demand.id}"><i class="bi bi-pencil-square"></i> Editar</button>
                    <button class="btn btn-outline-danger delete-btn" data-id="${demand.id}"><i class="bi bi-trash"></i> Excluir</button>
                </div>`;
            allRhDemandsListEl.appendChild(generalLi);
        }


        const demandStartDate = new Date(demand.startDate + 'T00:00:00');
        const demandEndDate = new Date(demand.endDate + 'T00:00:00');
        if (demand.type === 'ferias') {
             if (
                 (demandStartDate.getMonth() === currentMonth && demandStartDate.getFullYear() === currentYear) ||
                 (demandEndDate.getMonth() === currentMonth && demandEndDate.getFullYear() === currentYear) ||
                 (demandStartDate < new Date(currentYear, currentMonth, 1) && demandEndDate > new Date(currentYear, currentMonth + 1, 0))
              ) {
                if(feriasListEl) {
                    const li = document.createElement('li');
                    li.className = 'list-group-item';
                    li.textContent = listItemContentText;
                    feriasListEl.appendChild(li);
                    hasFerias = true;
                }
            }
        } else if (demand.type === 'abono') {
             const isWithinPeriod = (date) => date >= today && date <= fifteenDaysFromNow;
             if (isWithinPeriod(demandStartDate) || isWithinPeriod(demandEndDate) || (demandStartDate < today && demandEndDate > fifteenDaysFromNow)) {
                 if(abonosListEl) {
                    const li = document.createElement('li');
                    li.className = 'list-group-item';
                    li.textContent = listItemContentText;
                    abonosListEl.appendChild(li);
                    hasAbonos = true;
                 }
            }
        }
    });

    if(feriasListEl && !hasFerias) feriasListEl.innerHTML = '<li class="list-group-item text-muted">Nenhum funcionário de férias este mês.</li>';
    if(abonosListEl && !hasAbonos) abonosListEl.innerHTML = '<li class="list-group-item text-muted">Nenhum funcionário abonando nos próximos 15 dias.</li>';
    if(allRhDemandsListEl && allRhDemandsListEl.children.length === 0) allRhDemandsListEl.innerHTML = '<li class="list-group-item text-muted">Nenhuma demanda de RH registrada.</li>';

}

function openRhModalForEdit(demandId) {
    const demands = getFromLocalStorage('rh_demands');
    const demand = demands.find(d => d.id === demandId);
    if (demand && rhModalInstance) {
        document.getElementById('demandId').value = demand.id;
        document.getElementById('employeeName').value = demand.name;
        document.getElementById('demandType').value = demand.type;
        document.getElementById('startDate').value = demand.startDate;
        document.getElementById('endDate').value = demand.endDate;
         document.getElementById('rhModalLabel').textContent = 'Editar Demanda de RH';
        rhModalInstance.show();
    } else {
         console.error("Demanda RH não encontrada para modal de edição:", demandId);
    }
}

function deleteRhDemand(demandId) {
    if (confirm('Tem certeza que deseja excluir esta demanda de RH?')) {
        let demands = getFromLocalStorage('rh_demands');
        demands = demands.filter(d => d.id !== demandId);
        saveToLocalStorage('rh_demands', demands);
        renderRhLists();
        populateDashboardCards();
    }
}

// Marca demanda RH como ciente para o usuário logado
function handleAcknowledgeRhDemand(demandId) {
     const loggedInUserString = sessionStorage.getItem('loggedInUser');
     const loggedInUser = loggedInUserString ? JSON.parse(loggedInUserString) : null;
     const userEmail = loggedInUser ? loggedInUser.email : null;

     if (!userEmail) {
         alert("Você precisa estar logado para dar ciência.");
         return;
     }

     let demands = getFromLocalStorage('rh_demands');
     const demand = demands.find(d => d.id === demandId);

     if (demand) {
         if (!demand.acknowledgedBy) demand.acknowledgedBy = {};

         const currentState = demand.acknowledgedBy[userEmail] === true;
         demand.acknowledgedBy[userEmail] = !currentState;

         saveToLocalStorage('rh_demands', demands);

         const currentPage = window.location.pathname;
         if (currentPage.includes('rh_details.html')) {
              renderRhLists();
         } else if (currentPage.includes('dashboard.html')) {
             renderPendingItemsList();
         }

         populateDashboardCards();
     } else {
         console.error("Demanda RH não encontrada para dar ciência:", demandId);
     }
}


// --- DETALHES DE PROJETOS GERAIS (projects_details.html) e ATRIBUÍDOS (assigned_projects.html) ---

function normalizeClassName(str) {
    if (typeof str !== 'string') return '';
    return str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, '-');
}

// Initialize modals and forms used on BOTH project details pages
function initializeProjectModalsAndForms() {
     // Project Modal
    const projectModalEl = document.getElementById('projectModal');
    if (projectModalEl) {
        projectModalInstance = new bootstrap.Modal(projectModalEl);
        projectModalEl.addEventListener('hidden.bs.modal', () => {
             document.getElementById('projectForm').reset();
             document.getElementById('projectId').value = '';
             document.getElementById('projectModalLabel').textContent = 'Adicionar/Editar Projeto';
             document.getElementById('projectLocation').value = '';
             document.getElementById('projectLastModified').value = '';
         });
    }

     // Step Modal (for Project steps)
    const stepModalEl = document.getElementById('stepModal');
    if (stepModalEl) {
        stepModalInstance = new bootstrap.Modal(stepModalEl);
         stepModalEl.addEventListener('hidden.bs.modal', () => {
             document.getElementById('stepForm').reset();
             document.getElementById('stepId').value = '';
             document.getElementById('stepProjectId').value = '';
             document.getElementById('stepModalLabel').textContent = 'Adicionar/Editar Etapa';
         });
    }

     // Project Form Submission
    const projectForm = document.getElementById('projectForm');
    if(projectForm) projectForm.addEventListener('submit', handleProjectSubmit);

     // Step Form Submission (for Project steps)
    const stepForm = document.getElementById('stepForm');
    if(stepForm) stepForm.addEventListener('submit', handleStepSubmit);
}

// Function to initialize the general projects details page
function initializeProjectsDetailsPage() {
    initializeProjectModalsAndForms();
    populateAssignedToOptions();

    const addProjectBtn = document.getElementById('addProjectBtn');
    if (addProjectBtn) {
        addProjectBtn.addEventListener('click', () => {
            document.getElementById('projectForm').reset();
            document.getElementById('projectId').value = '';
            document.getElementById('projectModalLabel').textContent = 'Adicionar Projeto';
             document.getElementById('projectLocation').value = '';
             document.getElementById('projectLastModified').value = '';
             const assignedToSelect = document.getElementById('projectAssignedTo');
             if(assignedToSelect && assignedToSelect.options.length > 0) {
                 assignedToSelect.value = assignedToSelect.options[0].value;
             }
        });
    }

    renderProjectsTable();
}

// Function to initialize the assigned projects details page
function initializeAssignedProjectsPage() {
    initializeProjectModalsAndForms();
    populateAssignedToOptions();

    const assignedProjectsDetailsTitleEl = document.getElementById('assignedProjectsDetailsTitle');
    const loggedInUserString = sessionStorage.getItem('loggedInUser');
    const loggedInUser = loggedInUserString ? JSON.parse(loggedInUserString) : null;

    if (assignedProjectsDetailsTitleEl && loggedInUser && loggedInUser.role) {
        assignedProjectsDetailsTitleEl.textContent = `Projetos Atribuídos a: ${loggedInUser.role}`;
        const assignedToSelect = document.getElementById('projectAssignedTo');
         if(assignedToSelect) {
             assignedToSelect.value = loggedInUser.role;
         }

    } else if (assignedProjectsDetailsTitleEl) {
         assignedProjectsDetailsTitleEl.textContent = 'Projetos Atribuídos (Login Necessário)';
    }

    const allProjects = getFromLocalStorage('projects');
    let projectsToRender = [];

    if (loggedInUser && loggedInUser.role) {
        projectsToRender = allProjects.filter(project => project.assignedTo === loggedInUser.role);
    }
    renderProjectsTable(null, projectsToRender);

    setTimeout(handleUrlHighlight, 250);
}


function populateAssignedToOptions() {
    // Populates the select for Projects (main project modal)
    const selectElement = document.getElementById('projectAssignedTo');
    if (!selectElement) return;

     const options = getFromLocalStorage('assignedToOptions', []);

    selectElement.innerHTML = '';

    options.forEach(optionText => {
        const option = document.createElement('option');
        option.value = optionText;
        option.textContent = optionText;
        selectElement.appendChild(option);
    });
}


function handleProjectSubmit(event) {
    event.preventDefault();
    const id = document.getElementById('projectId').value;
    const description = document.getElementById('projectDescription').value.trim();
    const priority = document.getElementById('projectPriority').value;
    const status = document.getElementById('projectStatus').value;
    const assignedTo = document.getElementById('projectAssignedTo').value;

    if (!description || !assignedTo) {
        alert('Por favor, preencha a descrição do projeto e quem está atribuído.');
        return;
    }

    let projects = getFromLocalStorage('projects');
     projects.forEach(p => {
         if (!p.steps) p.steps = [];
          p.steps.forEach(step => { if (!step.acknowledgedBy) step.acknowledgedBy = {}; });
     });


    if (id) {
        const index = projects.findIndex(p => p.id === id);
        if (index > -1) {
            projects[index] = {
                ...projects[index],
                description,
                priority,
                status,
                assignedTo,
            };
             if (!projects[index].steps) projects[index].steps = [];
        } else {
             console.error('Projeto não encontrado para edição:', {id, projects});
             alert('Erro ao tentar editar o projeto.');
             return;
        }
    } else {
        const maxOrder = projects.reduce((max, p) => Math.max(max, p.orderIndex || 0), 0);
        const newProject = {
            id: Date.now().toString(),
            description,
            priority,
            status,
            assignedTo,
            location: '',
            lastModified: null,
            orderIndex: maxOrder + 1,
            steps: []
        };
        projects.push(newProject);
    }

    saveToLocalStorage('projects', projects);

    const currentPage = window.location.pathname;
    const baseHrefElement = document.querySelector('base');
    const baseHref = baseHrefElement ? baseHrefElement.getAttribute('href') : '/';
    let relativePath = currentPage.startsWith(baseHref) ? currentPage.substring(baseHref.length) : currentPage;
     if (relativePath.startsWith('/')) relativePath = relativePath.substring(1);
     if (relativePath.endsWith('/')) relativePath += 'index.html';

     if (relativePath.includes('projects_details.html')) {
         renderProjectsTable();
     } else if (relativePath.includes('assigned_projects.html')) {
         const loggedInUserString = sessionStorage.getItem('loggedInUser');
         const loggedInUser = loggedInUserString ? JSON.parse(loggedInUserString) : null;
         if (loggedInUser && loggedInUser.role) {
             const allProjects = getFromLocalStorage('projects');
             const projectsToRender = allProjects.filter(project => project.assignedTo === loggedInUser.role);
             renderProjectsTable(null, projectsToRender);
         } else {
             renderProjectsTable(null, []);
         }
     }


    populateDashboardCards();

    if (projectModalInstance) projectModalInstance.hide();
}

function renderProjectsTable(projectIdToExpand = null, projectsToRender = null) {
    let projects;
    let isFilteredView = false;

    if (projectsToRender !== null) {
        projects = [...projectsToRender];
        isFilteredView = true;
    } else {
        projects = getFromLocalStorage('projects');
    }

    const tableBody = document.getElementById('projectsTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '';

     projects.forEach(p => {
          if (!p.steps) p.steps = [];
          p.steps.forEach(step => { if (!step.acknowledgedBy) step.acknowledgedBy = {}; });
     });


    if (projects.length === 0) {
        const message = isFilteredView ? 'Nenhum projeto atribuído a você.' : 'Nenhum projeto cadastrado.';
        tableBody.innerHTML = `<tr><td colspan="8" class="text-center text-muted">${message}</td></tr>`;
        return;
    }

    if (!isFilteredView) {
        let maxOrder = 0;
        projects.forEach(p => {
            if (typeof p.orderIndex !== 'number' || p.orderIndex <= 0) {
                p.orderIndex = Infinity;
            }
            if (p.orderIndex !== Infinity && p.orderIndex > maxOrder) {
                maxOrder = p.orderIndex;
            }
        });
        projects.filter(p => p.orderIndex === Infinity).forEach(p => {
            maxOrder++;
            p.orderIndex = maxOrder;
        });

        const priorityOrderMap = { 'Alta': 1, 'Média': 2, 'Baixa': 3 };
        projects.sort((a, b) => {
            if (a.orderIndex !== b.orderIndex) {
                return a.orderIndex - b.orderIndex;
            }
             const priorityDiff = priorityOrderMap[a.priority] - priorityOrderMap[b.priority];
            if (priorityDiff !== 0) return priorityDiff;
            return a.description.localeCompare(b.description);
        });

        projects.forEach((p, index) => {
            p.orderIndex = index + 1;
        });
         saveToLocalStorage('projects', projects);
    } else {
         const priorityOrderMap = { 'Alta': 1, 'Média': 2, 'Baixa': 3 };
         projects.sort((a, b) => {
             const statusOrder = {'Pendente': 1, 'Em andamento': 2, 'Concluído': 3};
             const statusDiff = statusOrder[a.status] - statusOrder[b.status];
             if (statusDiff !== 0) return statusDiff;

             const priorityDiff = priorityOrderMap[a.priority] - priorityOrderMap[b.priority];
             if (priorityDiff !== 0) return priorityDiff;

             return a.description.localeCompare(b.description);
         });
    }

    projects.forEach((project) => {
        updateProjectLastStepInfo(project);

        const row = tableBody.insertRow();
        row.setAttribute('data-id', project.id);
        row.setAttribute('data-priority', project.priority);
         row.classList.add('project-row');
         row.style.cursor = 'pointer';

        const orderCell = row.insertCell();
        orderCell.className = 'text-center align-middle';
        if (!isFilteredView) {
             const currentProjectIndex = projects.findIndex(p => p.id === project.id);
            orderCell.innerHTML = `
                <div class="order-cell-content">
                    <span class="order-display">${project.orderIndex}</span>
                    <div class="btn-group-vertical btn-group-sm ms-2 order-controls">
                        <button class="btn btn-outline-secondary btn-move-up" ${currentProjectIndex === 0 ? 'disabled' : ''} data-id="${project.id}" title="Mover para Cima">
                            <i class="bi bi-caret-up-fill"></i>
                        </button>
                        <button class="btn btn-outline-secondary btn-move-down" ${currentProjectIndex === projects.length - 1 ? 'disabled' : ''} data-id="${project.id}" title="Mover para Baixo">
                            <i class="bi bi-caret-down-fill"></i>
                        </button>
                    </div>
                </div>`;
        } else {
            orderCell.textContent = project.orderIndex;
        }

        row.insertCell().textContent = project.description;
        row.insertCell().innerHTML = `<span class="badge bg-priority-${normalizeClassName(project.priority)}">${project.priority}</span>`;
        row.insertCell().innerHTML = `<span class="badge bg-status-${normalizeClassName(project.status)}">${project.status}</span>`;
        row.insertCell().textContent = project.assignedTo || 'Não atribuído';
        row.insertCell().textContent = project.lastModified || 'Sem etapas';
        row.insertCell().textContent = project.location || 'Sem etapas';


        const actionsCell = row.insertCell();
        actionsCell.className = 'project-actions text-center align-middle';
        actionsCell.innerHTML = `
            <div class="btn-group btn-group-sm">
                <button class="btn btn-outline-primary edit-btn" data-id="${project.id}"><i class="bi bi-pencil-square"></i> Editar</button>
                <button class="btn btn-outline-danger delete-btn" data-id="${project.id}"><i class="bi bi-trash"></i> Excluir</button>
            </div>`;

        const detailRow = tableBody.insertRow();
        detailRow.setAttribute('data-project-id', project.id);
        detailRow.classList.add('step-details-row');

        const detailCell = detailRow.insertCell();
        detailCell.colSpan = 8;
        detailCell.classList.add('step-details-cell');
        detailCell.innerHTML = `
            <div class="step-details-content">
                 <h5>Etapas do Projeto:</h5>
                 <div class="add-step-button-container">
                     <button class="btn btn-sm add-step-button" data-project-id="${project.id}">
                         <i class="bi bi-plus-circle"></i> Adicionar Etapa
                     </button>
                 </div>
                 <ul class="list-group step-list">
                     <!-- Steps will be rendered here by renderProjectSteps -->
                 </ul>
            </div>`;
         detailCell.querySelector('.step-details-content').style.display = 'none';
    });

     if (!tableBody.dataset.listenersAttached) {
         attachTableEventListeners(tableBody);
         attachStepEventListeners(tableBody);
         tableBody.dataset.listenersAttached = 'true';
     }
}


function renderProjectSteps(projectId) {
    const projects = getFromLocalStorage('projects');
    const project = projects.find(p => p.id === projectId);
    const detailRow = document.querySelector(`tr.step-details-row[data-project-id="${projectId}"]`);
    const stepListEl = detailRow ? detailRow.querySelector('.step-list') : null;

     const loggedInUserString = sessionStorage.getItem('loggedInUser');
     const loggedInUser = loggedInUserString ? JSON.parse(loggedInUserString) : null;
     const userEmail = loggedInUser ? loggedInUser.email : null;


    if (!project || !stepListEl) {
         console.error("Erro ao renderizar etapas de projeto: Projeto, linha de detalhe ou lista de etapas não encontrada.", { projectId, detailRowExists: !!detailRow, stepListExists: !!stepListEl });
         return;
    }

    stepListEl.innerHTML = '';

    const steps = project.steps || [];

     if (steps.length === 0) {
         stepListEl.innerHTML = '<li class="list-group-item text-muted text-center">Nenhuma etapa registrada para este projeto.</li>';
     } else {
        steps.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        steps.forEach(step => {
             if (!step.acknowledgedBy) step.acknowledgedBy = {};

            const displayDate = step.date ? new Date(step.date + 'T00:00:00').toLocaleDateString('pt-BR') : 'Data não informada';
            const listItem = document.createElement('li');
            listItem.classList.add('list-group-item', 'step-item');
            listItem.setAttribute('data-step-id', step.id);
            listItem.setAttribute('data-project-id', project.id);


             const isAcknowledged = userEmail && step.acknowledgedBy[userEmail] === true;
             const cienciaButtonClass = isAcknowledged ? 'btn-ciencia-acknowledged' : 'btn-ciencia-pending';
             const cienciaButtonText = isAcknowledged ? 'Ciente' : 'Dar Ciência';
             const cienciaButtonIcon = isAcknowledged ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill';


            listItem.innerHTML = `
                 <div class="step-item-content">
                     <strong>${step.responsable || 'Responsável não informado'}</strong>
                     <span><i class="bi bi-calendar-event"></i> ${displayDate}</span>
                     <span><i class="bi bi-geo-alt"></i> ${step.location || 'Local não informado'}</span>
                     <div class="step-description"><i class="bi bi-card-text"></i> ${step.description || 'Descrição não informada'}</div>
                     ${step.observation ? `<div class="text-muted small mt-1"><i class="bi bi-info-circle"></i> Obs: ${step.observation}</div>` : ''}
                 </div>
                 <div class="step-actions btn-group btn-group-sm">
                     ${userEmail ? `<button class="btn btn-ciencia ${cienciaButtonClass}" data-id="${step.id}" data-project-id="${project.id}" data-type="step"><i class="bi ${cienciaButtonIcon}"></i> ${cienciaButtonText}</button>` : ''}
                     <button class="btn btn-outline-primary edit-step-btn" data-id="${step.id}" data-project-id="${project.id}" title="Editar Etapa"><i class="bi bi-pencil-square"></i> Editar</button>
                     <button class="btn btn-outline-danger delete-step-btn" data-id="${step.id}" data-project-id="${project.id}" title="Excluir Etapa"><i class="bi bi-trash"></i> Excluir</button>
                 </div>
             `;
            stepListEl.appendChild(listItem);
        });
     }
    const detailContent = detailRow ? detailRow.querySelector('.step-details-content') : null;
     if(detailContent) {
         detailContent.style.display = 'block';
     }
}

// Event listeners attached using delegation on the table body
function attachTableEventListeners(tableBody) {
    if (tableBody.dataset.listenersAttached) return;

    tableBody.addEventListener('click', (event) => {
        const button = event.target.closest('.btn-move-up, .btn-move-down');
        if (!button) return;
        event.preventDefault();
        event.stopPropagation();
        const projectId = button.dataset.id;
        const direction = button.classList.contains('btn-move-up') ? 'up' : 'down';
        handleMoveMouseOut({ currentTarget: tableBody });
        moveProject(projectId, direction);
    });

    tableBody.addEventListener('click', (event) => {
         const editButton = event.target.closest('.edit-btn');
         const deleteButton = event.target.closest('.delete-btn');

         if (editButton) {
             event.preventDefault();
             event.stopPropagation();
             openProjectModalForEdit(editButton.dataset.id);
         } else if (deleteButton) {
             event.preventDefault();
             event.stopPropagation();
             deleteProject(deleteButton.dataset.id);
         }
    });

    tableBody.addEventListener('click', (event) => {
        const target = event.target;
        const row = target.closest('.project-row');
        const isButtonClickArea = target.closest('.project-actions, .order-controls');

        if (row && !isButtonClickArea) {
            const projectId = row.dataset.id;
            toggleProjectDetails(projectId);
        }
    });

    tableBody.addEventListener('mouseover', (event) => {
        const button = event.target.closest('.btn-move-up, .btn-move-down');
        if (button) {
             handleMoveHover(event);
        }
    });

     tableBody.addEventListener('mouseout', (event) => {
        const button = event.target.closest('.btn-move-up, .btn-move-down');
         if (button && !button.contains(event.relatedTarget) && event.relatedTarget !== button) {
             handleMoveMouseOut({ currentTarget: tableBody });
         }
    });
}

// Event listeners attached using delegation on the table body for Project step management
function attachStepEventListeners(tableBody) {
     if (tableBody.dataset.listenersAttached) return;

    // Click on Add Step button (within the details row)
    tableBody.addEventListener('click', (event) => {
        const addStepButton = event.target.closest('.add-step-button');
        if (!addStepButton) return;
        event.preventDefault();
        event.stopPropagation();
        const projectId = addStepButton.dataset.projectId;
        openStepModalForAdd(projectId);
    });

     // Click on Edit Step button
     tableBody.addEventListener('click', (event) => {
        const editStepButton = event.target.closest('.edit-step-btn');
        if (!editStepButton) return;
        event.preventDefault();
        event.stopPropagation();
        const stepId = editStepButton.dataset.id;
        const projectId = editStepButton.dataset.projectId;
        openStepModalForEdit(projectId, stepId);
    });

     // Click on Delete Step button
     tableBody.addEventListener('click', (event) => {
        const deleteStepButton = event.target.closest('.delete-step-btn'); // Corrected: event.target, not target
        if (!deleteStepButton) return;
        event.preventDefault();
        event.stopPropagation();
        const stepId = deleteStepButton.dataset.id;
        const projectId = deleteStepButton.dataset.projectId;
        deleteStep(projectId, stepId);
    });

     // Click on Step Science button (for Project Steps)
     tableBody.addEventListener('click', (event) => {
        const cienciaButton = event.target.closest('.btn-ciencia[data-type="step"]');
        if (!cienciaButton || !cienciaButton.dataset.projectId || !cienciaButton.dataset.id) return;

        event.preventDefault();
        event.stopPropagation();

        const projectId = cienciaButton.dataset.projectId;
        const stepId = cienciaButton.dataset.id;
        handleAcknowledgeStep(projectId, stepId);
     });
}


function toggleProjectDetails(projectId) {
    const projectRow = document.querySelector(`tr.project-row[data-id="${projectId}"]`);
    const detailRow = document.querySelector(`tr.step-details-row[data-project-id="${projectId}"]`);

    if (!projectRow || !detailRow) {
         console.error("Erro ao alternar detalhes de projeto: Linha do projeto ou linha de detalhe não encontrada.", { projectId, projectRowExists: !!projectRow, detailRowExists: !!detailRow });
         return;
    }

    const isExpanded = detailRow.style.display !== 'none';

    document.querySelectorAll('tr.step-details-row').forEach(row => {
         if (row !== detailRow && row.style.display !== 'none') {
              row.style.display = 'none';
             const correspondingProjectRow = document.querySelector(`tr.project-row[data-id="${row.dataset.projectId}"]`);
             if(correspondingProjectRow) correspondingProjectRow.classList.remove('project-row-expanded');
         }
     });


    if (isExpanded) {
        detailRow.style.display = 'none';
        projectRow.classList.remove('project-row-expanded');
    } else {
        renderProjectSteps(projectId);
        detailRow.style.display = 'table-row';
        projectRow.classList.add('project-row-expanded');
    }
}


function handleMoveHover(event) {
    const button = event.target.closest('.btn-move-up, .btn-move-down');
    const currentRow = button.closest('tr.project-row');
    if (!currentRow) return;

    let targetRow = null;
    if (button.classList.contains('btn-move-up')) {
        let prevRow = currentRow.previousElementSibling;
        while (prevRow && prevRow.classList.contains('step-details-row')) {
            prevRow = prevRow.previousElementSibling;
        }
        targetRow = prevRow;

    } else if (button.classList.contains('btn-move-down')) {
         let nextRow = currentRow.nextElementSibling;
        while (nextRow && nextRow.classList.contains('step-details-row')) {
             nextRow = nextRow.nextElementSibling;
         }
        targetRow = nextRow;
    }

    currentRow.classList.add('row-hover-highlight');
    if (targetRow && targetRow.classList.contains('project-row')) {
        targetRow.classList.add('row-hover-highlight');
    }
}

function handleMoveMouseOut(event) {
     const tableBody = event.currentTarget;
     if (!tableBody) return;

     tableBody.querySelectorAll('.row-hover-highlight').forEach(row => {
        row.classList.remove('row-hover-highlight');
    });
}


function moveProject(projectId, direction) {
    let projects = getFromLocalStorage('projects');
    projects.forEach(p => {
        if (!p.steps) p.steps = [];
        if (typeof p.orderIndex !== 'number') p.orderIndex = Infinity;
         p.steps.forEach(step => { if (!step.acknowledgedBy) step.acknowledgedBy = {}; });
    });

    projects.sort((a, b) => a.orderIndex - b.orderIndex);

    const currentIndex = projects.findIndex(p => p.id === projectId);
    if (currentIndex === -1) return;

    let targetIndex = -1;
    if (direction === 'up' && currentIndex > 0) {
        targetIndex = currentIndex - 1;
    } else if (direction === 'down' && currentIndex < projects.length - 1) {
        targetIndex = currentIndex + 1;
    }

    if (targetIndex !== -1) {
        [projects[currentIndex], projects[targetIndex]] = [projects[targetIndex], projects[currentIndex]];
        projects.forEach((p, index) => { p.orderIndex = index + 1; });

        saveToLocalStorage('projects', projects);

        const currentPage = window.location.pathname;
        const baseHrefElement = document.querySelector('base');
        const baseHref = baseHrefElement ? baseHrefElement.getAttribute('href') : '/';
        let relativePath = currentPage.startsWith(baseHref) ? currentPage.substring(baseHref.length) : currentPage;
         if (relativePath.startsWith('/')) relativePath = relativePath.substring(1);
         if (relativePath.endsWith('/')) relativePath += 'index.html';

         if (relativePath.includes('projects_details.html')) {
             renderProjectsTable();
         } else if (relativePath.includes('assigned_projects.html')) {
             const loggedInUserString = sessionStorage.getItem('loggedInUser');
             const loggedInUser = loggedInUserString ? JSON.parse(loggedInUserString) : null;
             if (loggedInUser && loggedInUser.role) {
                 const allProjects = getFromLocalStorage('projects');
                 const projectsToRender = allProjects.filter(project => project.assignedTo === loggedInUser.role);
                 renderProjectsTable(null, projectsToRender);
             } else {
                  renderProjectsTable(null, []);
             }
        }
        populateDashboardCards();
    }
}


function openProjectModalForEdit(projectId) {
    const projects = getFromLocalStorage('projects');
    const project = projects.find(p => p.id === projectId);
    if (project && projectModalInstance) {
        document.getElementById('projectId').value = project.id;
        document.getElementById('projectDescription').value = project.description;
        document.getElementById('projectPriority').value = project.priority;
        document.getElementById('projectStatus').value = project.status;
        document.getElementById('projectAssignedTo').value = project.assignedTo || assignedToOptions[0];

        document.getElementById('projectLocation').value = project.location || 'Sem etapas';
        document.getElementById('projectLastModified').value = project.lastModified || 'Sem etapas';

        document.getElementById('projectModalLabel').textContent = 'Editar Projeto';
        projectModalInstance.show();
    } else {
         console.error('Projeto não encontrado para edição:', { projectId });
    }
}

function deleteProject(projectId) {
    if (confirm('Tem certeza que deseja excluir este projeto e todas as suas etapas?')) {
        let projects = getFromLocalStorage('projects');
        projects = projects.filter(p => p.id !== projectId);

        const currentPage = window.location.pathname;
        const baseHrefElement = document.querySelector('base');
        const baseHref = baseHrefElement ? baseHrefElement.getAttribute('href') : '/';
        let relativePath = currentPage.startsWith(baseHref) ? currentPage.substring(baseHref.length) : currentPage;
         if (relativePath.startsWith('/')) relativePath = relativePath.substring(1);
         if (relativePath.endsWith('/')) relativePath += 'index.html';

        if (relativePath.includes('projects_details.html')) {
             projects.sort((a, b) => (a.orderIndex || Infinity) - (b.orderIndex || Infinity));
             projects.forEach((p, index) => {
                 p.orderIndex = index + 1;
             });
             saveToLocalStorage('projects', projects);
             renderProjectsTable();
        } else if (relativePath.includes('assigned_projects.html')) {
             saveToLocalStorage('projects', projects);

             const loggedInUserString = sessionStorage.getItem('loggedInUser');
             const loggedInUser = loggedInUserString ? JSON.parse(loggedInUserString) : null;
             if (loggedInUser && loggedInUser.role) {
                 const allProjects = getFromLocalStorage('projects');
                 const projectsToRender = allProjects.filter(project => project.assignedTo === loggedInUser.role);
                 renderProjectsTable(null, projectsToRender);
             } else {
                  renderProjectsTable(null, []);
             }
        } else {
             saveToLocalStorage('projects', projects);
             alert("Projeto excluído. Atualize a página se a lista não refletir a mudança.");
        }

        populateDashboardCards();
    }
}


// --- Funções para gerenciar Etapas de Projetos ---

function openStepModalForAdd(projectId) {
    if (stepModalInstance) {
         document.getElementById('stepForm').reset();
         document.getElementById('stepId').value = '';
         document.getElementById('stepProjectId').value = projectId;
         document.getElementById('stepModalLabel').textContent = 'Adicionar Etapa';

         const today = new Date().toISOString().split('T')[0];
         document.getElementById('stepDate').value = today;

         stepModalInstance.show();
    }
}

function openStepModalForEdit(projectId, stepId) {
    const projects = getFromLocalStorage('projects');
    const project = projects.find(p => p.id === projectId);
    const step = project ? project.steps.find(s => s.id === stepId) : null;

    if (step && stepModalInstance) {
        document.getElementById('stepId').value = step.id;
        document.getElementById('stepProjectId').value = projectId;
        document.getElementById('stepResponsable').value = step.responsable || '';
        document.getElementById('stepDescription').value = step.description || '';
        document.getElementById('stepLocation').value = step.location || '';
        document.getElementById('stepDate').value = step.date || '';
        document.getElementById('stepObservation').value = step.observation || '';
        document.getElementById('stepModalLabel').textContent = 'Editar Etapa';
        stepModalInstance.show();
    } else {
         console.error('Etapa ou projeto não encontrado para edição:', { projectId, stepId });
    }
}

function handleStepSubmit(event) {
    event.preventDefault();
    const stepId = document.getElementById('stepId').value;
    const projectId = document.getElementById('stepProjectId').value;
    const responsable = document.getElementById('stepResponsable').value.trim();
    const description = document.getElementById('stepDescription').value.trim();
    const location = document.getElementById('stepLocation').value.trim();
    const date = document.getElementById('stepDate').value;
    const observation = document.getElementById('stepObservation').value.trim();

    if (!projectId || !responsable || !description || !date) {
        alert('Por favor, preencha os campos obrigatórios (Responsável, Descrição, Data).');
        return;
    }

    let projects = getFromLocalStorage('projects');
    const projectIndex = projects.findIndex(p => p.id === projectId);

    if (projectIndex === -1) {
        console.error('Projeto pai não encontrado para a etapa.');
        return;
    }

    const project = projects[projectIndex];
    if (!project.steps) project.steps = [];

    const currentTimestamp = new Date().toISOString();

    if (stepId) {
        const stepIndex = project.steps.findIndex(s => s.id === stepId);
        if (stepIndex > -1) {
            project.steps[stepIndex] = {
                ...project.steps[stepIndex],
                responsable,
                description,
                location,
                date,
                observation,
                timestamp: currentTimestamp
            };
             if (!project.steps[stepIndex].acknowledgedBy) project.steps[stepIndex].acknowledgedBy = {};
        } else {
             console.error('Etapa não encontrada no projeto pai para edição.');
             return;
        }
    } else {
        const newStep = {
            id: Date.now().toString(),
            projectId,
            responsable,
            description,
            location,
            date,
            observation,
            timestamp: currentTimestamp,
            acknowledgedBy: {}
        };
        project.steps.push(newStep);
    }

    updateProjectLastStepInfo(project);

    saveToLocalStorage('projects', projects);

    if (stepModalInstance) stepModalInstance.hide();

    const detailRow = document.querySelector(`tr.step-details-row[data-project-id="${projectId}"]`);
     const currentPage = window.location.pathname;
     const baseHrefElement = document.querySelector('base');
     const baseHref = baseHrefElement ? baseHrefElement.getAttribute('href') : '/';
     let relativePath = currentPage.startsWith(baseHref) ? currentPage.substring(baseHref.length) : currentPage;
      if (relativePath.startsWith('/')) relativePath = relativePath.substring(1);
      if (relativePath.endsWith('/')) relativePath += 'index.html';


    if (relativePath.includes('projects_details.html') || relativePath.includes('assigned_projects.html')) {
         if (detailRow && detailRow.style.display !== 'none') {
              renderProjectSteps(projectId);
         }
         updateProjectRowDisplay(projectId);
    } else {
         console.log(`Etapa de Projeto salva para projeto ${projectId}.`);
    }

    populateDashboardCards();
}

function updateProjectLastStepInfo(project) {
     if (project.steps && project.steps.length > 0) {
        const latestStep = project.steps.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
         const lastModifiedDate = new Date(latestStep.timestamp);
         if (!isNaN(lastModifiedDate.getTime())) {
            project.lastModified = lastModifiedDate.toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'});
         } else {
            project.lastModified = 'Data inválida';
         }

        project.location = latestStep.location || 'Não informado';
    } else {
        project.lastModified = 'Sem etapas';
        project.location = 'Sem etapas';
    }
}

function updateProjectRowDisplay(projectId) {
    const projectRow = document.querySelector(`tr.project-row[data-id="${projectId}"]`);
    if (!projectRow) return;

    const projects = getFromLocalStorage('projects');
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const cells = projectRow.querySelectorAll('td');
    if (cells.length > 6) { // Check if cells exist to avoid errors
        cells[4].textContent = project.assignedTo || 'Não atribuído';
        cells[5].textContent = project.lastModified || 'Sem etapas';
        cells[6].textContent = project.location || 'Sem etapas';
         const statusCell = cells[3];
         if (statusCell) {
              statusCell.innerHTML = `<span class="badge bg-status-${normalizeClassName(project.status)}">${project.status}</span>`;
         }
    } else {
         console.warn(`Cells for project row ${projectId} not found or not enough cells to update display.`);
    }
}


function deleteStep(projectId, stepId) {
    if (confirm('Tem certeza que deseja excluir esta etapa?')) {
        let projects = getFromLocalStorage('projects');
        const projectIndex = projects.findIndex(p => p.id === projectId);

        if (projectIndex === -1) {
            console.error('Projeto pai não encontrado para excluir etapa.');
            return;
        }

        const project = projects[projectIndex];
        if (!project.steps) project.steps = [];

        project.steps = project.steps.filter(s => s.id !== stepId);

        updateProjectLastStepInfo(project);

        saveToLocalStorage('projects', projects);

        const detailRow = document.querySelector(`tr.step-details-row[data-project-id="${projectId}"]`);
         const currentPage = window.location.pathname;
         const baseHrefElement = document.querySelector('base');
         const baseHref = baseHrefElement ? baseHrefElement.getAttribute('href') : '/';
         let relativePath = currentPage.startsWith(baseHref) ? currentPage.substring(baseHref.length) : currentPage;
          if (relativePath.startsWith('/')) relativePath = relativePath.substring(1);
          if (relativePath.endsWith('/')) relativePath += 'index.html';


        if (relativePath.includes('projects_details.html') || relativePath.includes('assigned_projects.html')) {
             if (detailRow && detailRow.style.display !== 'none') {
                 renderProjectSteps(projectId);
             }
             updateProjectRowDisplay(projectId);
        } else {
             console.log(`Etapa de Projeto excluída para projeto ${projectId}.`);
        }

        populateDashboardCards();
    }
}

// Marca etapa de projeto como ciente para o usuário logado
function handleAcknowledgeStep(projectId, stepId) {
     const loggedInUserString = sessionStorage.getItem('loggedInUser');
     const loggedInUser = loggedInUserString ? JSON.parse(loggedInUserString) : null;
     const userEmail = loggedInUser ? loggedInUser.email : null;

     if (!userEmail) {
         alert("Você precisa estar logado para dar ciência.");
         return;
     }

     let projects = getFromLocalStorage('projects');
     const projectIndex = projects.findIndex(p => p.id === projectId);

     if (projectIndex === -1) {
         console.error("Projeto pai da etapa não encontrado:", projectId);
         return;
     }

     const project = projects[projectIndex];
     const step = project.steps ? project.steps.find(s => s.id === stepId) : null;

     if (step) {
         if (!step.acknowledgedBy) step.acknowledgedBy = {};

         const currentState = step.acknowledgedBy[userEmail] === true;
         step.acknowledgedBy[userEmail] = !currentState;

         saveToLocalStorage('projects', projects);

         const currentPage = window.location.pathname;
         const baseHrefElement = document.querySelector('base');
         const baseHref = baseHrefElement ? baseHrefElement.getAttribute('href') : '/';
         let relativePath = currentPage.startsWith(baseHref) ? currentPage.substring(baseHref.length) : currentPage;
          if (relativePath.startsWith('/')) relativePath = relativePath.substring(1);
          if (relativePath.endsWith('/')) relativePath += 'index.html';


         if (relativePath.includes('projects_details.html') || relativePath.includes('assigned_projects.html')) {
              const detailRow = document.querySelector(`tr.step-details-row[data-project-id="${projectId}"]`);
              if (detailRow && detailRow.style.display !== 'none') {
                   renderProjectSteps(projectId);
               }
         } else if (relativePath.includes('dashboard.html')) {
             renderPendingItemsList();
         }

         populateDashboardCards();
     } else {
         console.error("Etapa de Projeto não encontrada para dar ciência:", { projectId, stepId });
     }
}


// --- Demandas Dia a Dia (daytoday_details.html e completed_demands.html) ---

// Initialize modals and forms used on Day to Day pages
function initializeDaytodayModalsAndForms() {
     // Day to Day Demand Modal
     const daytodayModalEl = document.getElementById('daytodayModal');
     if (daytodayModalEl) {
         daytodayModalInstance = new bootstrap.Modal(daytodayModalEl);
          daytodayModalEl.addEventListener('hidden.bs.modal', () => {
              document.getElementById('daytodayForm').reset();
              document.getElementById('daytodayId').value = '';
              document.getElementById('daytodayModalLabel').textContent = 'Adicionar/Editar Demanda';
              const assignedToRoleSelect = document.getElementById('daytodayAssignedToRole');
               if(assignedToRoleSelect && assignedToRoleSelect.options.length > 0) {
                   assignedToRoleSelect.value = assignedToRoleSelect.options[0].value;
               }
          });
     }

     // Day to Day Step Modal
     const daytodayStepModalEl = document.getElementById('daytodayStepModal');
     if (daytodayStepModalEl) {
         daytodayStepModalInstance = new bootstrap.Modal(daytodayStepModalEl);
          daytodayStepModalEl.addEventListener('hidden.bs.modal', () => {
              document.getElementById('daytodayStepForm').reset();
              document.getElementById('daytodayStepId').value = '';
              document.getElementById('daytodayStepDemandId').value = '';
              document.getElementById('daytodayStepModalLabel').textContent = 'Adicionar/Editar Etapa';
               const currentFilesDiv = document.getElementById('daytodayStepCurrentFiles');
               if(currentFilesDiv) currentFilesDiv.innerHTML = '';
               const assignedToRoleSelect = document.getElementById('daytodayStepAssignedToRole');
                if(assignedToRoleSelect && assignedToRoleSelect.options.length > 0) {
                   assignedToRoleSelect.value = assignedToRoleSelect.options[0].value;
               }
          });
     }

     // Day to Day Demand Form Submission
     const daytodayForm = document.getElementById('daytodayForm');
     if(daytodayForm) daytodayForm.addEventListener('submit', handleDaytodaySubmit);

     // Day to Day Step Form Submission
     const daytodayStepForm = document.getElementById('daytodayStepForm');
     if(daytodayStepForm) daytodayStepForm.addEventListener('submit', handleDaytodayStepSubmit);
}

// Populates the 'Atribuído a (Núcleo/Cargo)' select in the Day to Day modals
function populateAssignedToRoleOptions() {
    // Find the select in the main demand modal
    const demandSelectElement = document.getElementById('daytodayAssignedToRole');
    if (demandSelectElement) {
         const options = getFromLocalStorage('assignedToOptions', []);
         demandSelectElement.innerHTML = '';
         options.forEach(optionText => {
             const option = document.createElement('option');
             option.value = optionText;
             option.textContent = optionText;
             demandSelectElement.appendChild(option);
         });
    }

     // Find the select in the step modal
    const stepSelectElement = document.getElementById('daytodayStepAssignedToRole');
     if (stepSelectElement) {
         const options = getFromLocalStorage('assignedToOptions', []);
         stepSelectElement.innerHTML = '';
         options.forEach(optionText => {
             const option = document.createElement('option');
             option.value = optionText;
             option.textContent = optionText;
             stepSelectElement.appendChild(option);
         });
     }
}


// Function to initialize the active Day to Day details page
function initializeDaytodayDetailsPage() {
    initializeDaytodayModalsAndForms();
    populateAssignedToRoleOptions();

    const addDaytodayBtn = document.getElementById('addDaytodayBtn');
    if (addDaytodayBtn) {
        addDaytodayBtn.addEventListener('click', () => {
            document.getElementById('daytodayForm').reset();
            document.getElementById('daytodayId').value = ''; // Clear ID for new item
            document.getElementById('daytodayModalLabel').textContent = 'Adicionar Demanda';

            const loggedInUserString = sessionStorage.getItem('loggedInUser');
            const loggedInUser = loggedInUserString ? JSON.parse(loggedInUserString) : null;
             const assignedToRoleSelect = document.getElementById('daytodayAssignedToRole');
             if (loggedInUser && loggedInUser.role && assignedToRoleSelect) {
                  assignedToRoleSelect.value = loggedInUser.role;
             } else if (assignedToRoleSelect && assignedToRoleSelect.options.length > 0) {
                  assignedToRoleSelect.value = assignedToRoleSelect.options[0].value;
             }
        });
    }

    renderDaytodayLists(['Pendente', 'Em andamento', 'Cancelado']);

     const myDaytodayList = document.getElementById('myDaytodayList');
     const allDaytodayList = document.getElementById('allDaytodayList');
     if (myDaytodayList && !myDaytodayList.dataset.listenersAttached) {
         attachDaytodayListEventListeners(myDaytodayList);
     }
      if (allDaytodayList && !allDaytodayList.dataset.listenersAttached) {
         attachDaytodayListEventListeners(allDaytodayList);
     }


    setTimeout(handleUrlHighlight, 250);
}

// Function to initialize the completed Day to Day demands page
function initializeCompletedDemandsPage() {
    initializeDaytodayModalsAndForms();
    populateAssignedToRoleOptions();

    // No "Add" button on this page

    renderDaytodayLists(['Concluído']);

     const completedDaytodayList = document.getElementById('completedDaytodayList');
      if (completedDaytodayList && !completedDaytodayList.dataset.listenersAttached) {
         attachDaytodayListEventListeners(completedDaytodayList);
     }


    setTimeout(handleUrlHighlight, 250);
}


// Handles submission of the Day to Day demand form
function handleDaytodaySubmit(event) {
    event.preventDefault();
    const id = document.getElementById('daytodayId').value;
    const description = document.getElementById('daytodayDescription').value.trim();
    const assignedToRole = document.getElementById('daytodayAssignedToRole').value;
    const status = document.getElementById('daytodayStatus').value;

    const loggedInUserString = sessionStorage.getItem('loggedInUser');
    const loggedInUser = loggedInUserString ? JSON.parse(loggedInUserString) : null;
    const createdByEmail = loggedInUser ? loggedInUser.email : 'desconhecido@example.com';


    if (!description || !assignedToRole || !status) {
        alert('Por favor, preencha a descrição da demanda, o núcleo/cargo atribuído e a situação.');
        return;
    }

    let demands = getFromLocalStorage('daytoday_demands');

    if (id) { // Editing existing demand
        const index = demands.findIndex(d => d.id === id);
        if (index > -1) {
            demands[index] = {
                ...demands[index],
                description,
                assignedToRole,
                status,
            };
             if (!demands[index].steps) demands[index].steps = [];
             if (!demands[index].acknowledgedBy) demands[index].acknowledgedBy = {};
        } else {
             console.error('Demanda Dia a Dia não encontrada para edição:', {id, demands});
             alert('Erro ao tentar editar a demanda.');
             return;
        }
    } else { // Adding new demand
        const newDemand = {
            id: Date.now().toString(),
            description,
            assignedToRole,
            status,
            inclusionDate: new Date().toISOString().split('T')[0],
            createdByEmail: createdByEmail,
            steps: [],
            acknowledgedBy: {}
        };
         // Automaticamente dá ciência ao criador NA DEMANDA
        if (createdByEmail !== 'desconhecido@example.com') {
             newDemand.acknowledgedBy[createdByEmail] = true;
        }
        demands.push(newDemand);
    }

    saveToLocalStorage('daytoday_demands', demands);

    const currentPage = window.location.pathname;
     if (currentPage.includes('daytoday_details.html')) {
         renderDaytodayLists(['Pendente', 'Em andamento', 'Cancelado']); // Rerender active lists
     } else if (currentPage.includes('completed_demands.html')) {
          renderDaytodayLists(['Concluído']); // Rerender completed lists
     } // No else needed for dashboard, populateDashboardCards handles it


    populateDashboardCards();
    if (daytodayModalInstance) daytodayModalInstance.hide();
}

// Renders the lists of Day to Day demands based on a status filter
function renderDaytodayLists(allowedStatuses = null) {
    let demands = getFromLocalStorage('daytoday_demands');
    const myDaytodayListEl = document.getElementById('myDaytodayList');
    const allDaytodayListEl = document.getElementById('allDaytodayList');
     const completedDaytodayListEl = document.getElementById('completedDaytodayList');


     const loggedInUserString = sessionStorage.getItem('loggedInUser');
     const loggedInUser = loggedInUserString ? JSON.parse(loggedInUserString) : null;
     const userEmail = loggedInUser ? loggedInUser.email : null;
     const userRole = loggedInUser ? loggedInUser.role : null;


    // Filter demands by status if allowedStatuses is provided
     if (allowedStatuses && Array.isArray(allowedStatuses)) {
         demands = demands.filter(d => allowedStatuses.includes(d.status));
     }


    // Ensure demands and steps have necessary properties for rendering
    demands.forEach(d => {
         if (!d.acknowledgedBy) d.acknowledgedBy = {};
         if (!d.steps) d.steps = [];
         d.steps.forEach(step => {
             if (!step.acknowledgedBy) step.acknowledgedBy = {};
             if (!step.files) step.files = {};
         });
    });


    // Sort demands (e.g., by status, then inclusion date)
     const statusOrder = {'Pendente': 1, 'Em andamento': 2, 'Concluído': 3, 'Cancelado': 4};
     demands.sort((a, b) => {
         const statusDiff = statusOrder[a.status] - statusOrder[b.status];
         if (statusDiff !== 0) return statusDiff;
         return new Date(a.inclusionDate) - new Date(b.inclusionDate); // Oldest first
     });


    let myDemandsCount = 0;


    // Clear lists based on which ones exist on the current page
     if(myDaytodayListEl) myDaytodayListEl.innerHTML = '';
     if(allDaytodayListEl) allDaytodayListEl.innerHTML = '';
     if(completedDaytodayListEl) completedDaytodayListEl.innerHTML = '';


    if (demands.length === 0) {
         const message = allowedStatuses && allowedStatuses.includes('Concluído') ? 'Nenhuma demanda concluída.' : 'Nenhuma demanda ativa registrada.';
         if(myDaytodayListEl) myDaytodayListEl.innerHTML = '<li class="list-group-item text-muted text-center">Nenhuma demanda ativa atribuída a você.</li>';
         if(allDaytodayListEl) allDaytodayListEl.innerHTML = `<li class="list-group-item text-muted text-center">${message}</li>`;
         if(completedDaytodayListEl) completedDaytodayListEl.innerHTML = `<li class="list-group-item text-muted text-center">${message}</li>`;
        return;
    }


    demands.forEach(demand => {
        const displayInclusionDate = demand.inclusionDate ? new Date(demand.inclusionDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'Data não informada';
        const assignedRole = demand.assignedToRole || 'Não atribuído';


        const listItem = document.createElement('li');
        listItem.classList.add('list-group-item');
        listItem.setAttribute('data-id', demand.id);
        listItem.setAttribute('data-type', 'daytoday-demand');
        listItem.classList.add(`list-group-item-${normalizeClassName(demand.status)}`);

        // Determine science status and button appearance for the logged-in user ON THE DEMAND ITSELF (Creator only)
         const isDemandAcknowledgedByMe = userEmail && demand.acknowledgedBy[userEmail] === true;
         const demandCienciaButtonClass = isDemandAcknowledgedByMe ? 'btn-ciencia-acknowledged' : 'btn-ciencia-pending';
         const demandCienciaButtonText = isDemandAcknowledgedByMe ? 'Ciente' : 'Ciência';
         const demandCienciaButtonIcon = isDemandAcknowledgedByMe ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill';


        listItem.innerHTML = `
             <div class="list-group-item-header">
                 <strong>${demand.description || 'Sem descrição'}</strong>
                 <span><i class="bi bi-calendar-event"></i> ${displayInclusionDate}</span>
                 <span><i class="bi bi-person"></i> Atribuído a: ${assignedRole}</span>
                 <span class="badge bg-status-${normalizeClassName(demand.status)}">${demand.status}</span>
             </div>
             <div class="list-group-item-actions btn-group btn-group-sm">
                  <!-- Botão de Ciência para a Demanda (visível apenas para o criador, se precisar dar ciência) -->
                 ${userEmail === demand.createdByEmail ? `<button class="btn btn-ciencia ${demandCienciaButtonClass}" data-id="${demand.id}" data-type="daytoday-demand-science" title="${demandCienciaButtonText}"><i class="bi ${demandCienciaButtonIcon}"></i></button>` : ''}
                  <!-- Botões de ação da demanda -->
                 <button class="btn btn-outline-primary edit-daytoday-btn" data-id="${demand.id}" title="Editar Demanda"><i class="bi bi-pencil-square"></i></button>
                 <button class="btn btn-outline-danger delete-daytoday-btn" data-id="${demand.id}" title="Excluir Demanda"><i class="bi bi-trash"></i></button>
             </div>
             <!-- Area para detalhes da etapa (initially hidden) -->
             <div class="daytoday-step-details" data-demand-id="${demand.id}">
                  <!-- Content will be rendered by renderDaytodaySteps -->
             </div>
         `;

        // Add to lists based on status and assignment, and page
        const currentPage = window.location.pathname;
        const baseHrefElement = document.querySelector('base');
        const baseHref = baseHrefElement ? baseHrefElement.getAttribute('href') : '/';
        let relativePath = currentPage.startsWith(baseHref) ? currentPage.substring(baseHref.length) : currentPage;
         if (relativePath.startsWith('/')) relativePath = relativePath.substring(1);
         if (relativePath.endsWith('/')) relativePath += 'index.html';


        if (relativePath.includes('daytoday_details.html')) { // On Active page
             if (userRole && demand.assignedToRole === userRole) { // Assigned to me
                 if(myDaytodayListEl) myDaytodayListEl.appendChild(listItem.cloneNode(true)); // Corrected variable name myDaytodayListEl
                 myDemandsCount++;
             }
             if(allDaytodayListEl) allDaytodayListEl.appendChild(listItem);  // Corrected variable name allDaytodayListEl
         } else if (relativePath.includes('completed_demands.html')) { // On Completed page
              if(completedDaytodayListEl) completedDaytodayListEl.appendChild(listItem);
         }
    });

    // Set empty messages based on which list elements exist and were targeted
     if(myDaytodayListEl && myDaytodayListEl.children.length === 0 && allowedStatuses && allowedStatuses.filter(s => s !== 'Concluído').length > 0) myDaytodayListEl.innerHTML = '<li class="list-group-item text-muted text-center">Nenhuma demanda ativa atribuída a você.</li>';
     if(allDaytodayListEl && allDaytodayListEl.children.length === 0 && allowedStatuses && allowedStatuses.filter(s => s !== 'Concluído').length > 0) allDaytodayListEl.innerHTML = '<li class="list-group-item text-muted text-center">Nenhuma demanda ativa registrada.</li>';
      if(completedDaytodayListEl && completedDaytodayListEl.children.length === 0 && allowedStatuses && allowedStatuses.includes('Concluído')) completedDaytodayListEl.innerHTML = '<li class="list-group-item text-muted text-center">Nenhuma demanda concluída registrada.</li>';

}

// Attaches event listeners for Day to Day lists using delegation
function attachDaytodayListEventListeners(listElement) {
    if (!listElement || listElement.dataset.listenersAttached) return;

    listElement.addEventListener('click', (event) => {
        const target = event.target;

        // Handle click on "Dar Ciência" button (on the demand itself - data-type="daytoday-demand-science")
        const demandCienciaButton = target.closest('.btn-ciencia[data-type="daytoday-demand-science"]');
        if (demandCienciaButton) {
            event.preventDefault();
            event.stopPropagation();
            const demandId = demandCienciaButton.dataset.id;
            handleAcknowledgeDaytodayDemand(demandId);
            return;
        }

        // Handle click on Edit button (on the demand itself - class="edit-daytoday-btn")
        const editButton = target.closest('.edit-daytoday-btn');
        if (editButton) {
            event.preventDefault();
            event.stopPropagation();
            openDaytodayModalForEdit(editButton.dataset.id);
            return;
        }

        // Handle click on Delete button (on the demand itself - class="delete-daytoday-btn")
        const deleteButton = target.closest('.delete-daytoday-btn');
        if (deleteButton) {
            event.preventDefault();
            event.stopPropagation();
            deleteDaytodayDemand(deleteButton.dataset.id);
            return;
        }

        // Handle click on the list item itself (to toggle step details)
        const listItem = target.closest('.list-group-item');
         const isActionAreaClick = target.closest('.list-group-item-actions');
        if (listItem && !isActionAreaClick) {
             const demandId = listItem.dataset.id;
             toggleDaytodayDetails(demandId);
        }
    });

     // Listener for step buttons within the expanded details (using delegation on the list element)
     listElement.addEventListener('click', (event) => {
         const target = event.target;

         // Handle click on Add Step button
         const addStepButton = target.closest('.daytoday-add-step-button');
         if (addStepButton) {
             event.preventDefault();
             event.stopPropagation();
             const demandId = addStepButton.dataset.demandId;
             openDaytodayStepModalForAdd(demandId);
             return;
         }

         // Handle click on Edit Step button
         const editStepButton = target.closest('.edit-daytoday-step-btn');
         if (editStepButton) {
              event.preventDefault();
              event.stopPropagation();
              const demandId = editStepButton.dataset.demandId;
              const stepId = editStepButton.dataset.id;
              openDaytodayStepModalForEdit(demandId, stepId);
              return;
         }

         // Handle click on Delete Step button
         const deleteStepButton = target.closest('.delete-daytoday-step-btn');
         if (deleteStepButton) {
              event.preventDefault();
              event.stopPropagation();
              const demandId = deleteStepButton.dataset.demandId;
              const stepId = deleteStepButton.dataset.id;
              deleteDaytodayStep(demandId, stepId);
               return;
         }

         // Handle click on Science Step button
         const cienciaStepButton = target.closest('.btn-ciencia[data-type="daytoday"]');
         if (cienciaStepButton) {
             event.preventDefault();
             event.stopPropagation();
             const demandId = cienciaStepButton.dataset.demandId;
             const stepId = cienciaStepButton.dataset.id;
             handleAcknowledgeDaytodayStep(demandId, stepId);
             return;
         }
     });


     listElement.dataset.listenersAttached = 'true';
}

// Toggles the visibility of Day to Day demand details (steps)
function toggleDaytodayDetails(demandId) {
     const demandItem = document.querySelector(`.daytoday-demand-list li.list-group-item[data-id="${demandId}"]`);
     const detailsDiv = demandItem ? demandItem.querySelector('.daytoday-step-details') : null;


     if (!demandItem || !detailsDiv) {
          console.error("Erro ao alternar detalhes Demanda Dia a Dia: Item ou detalhes não encontrados.", { demandId, demandItemExists: !!demandItem, detailsDivExists: !!detailsDiv });
          return;
     }

     const isExpanded = detailsDiv.style.display !== 'none' && detailsDiv.style.display !== '';

     document.querySelectorAll('.daytoday-step-details').forEach(div => {
          if (div !== detailsDiv && (div.style.display !== 'none' && div.style.display !== '')) {
               div.style.display = 'none';
          }
     });


     if (isExpanded) {
          detailsDiv.style.display = 'none';
     } else {
          renderDaytodaySteps(demandId);
          detailsDiv.style.display = 'block';
     }
}

// Renders steps for a specific Day to Day demand
function renderDaytodaySteps(demandId) {
     const demands = getFromLocalStorage('daytoday_demands');
     const demand = demands.find(d => d.id === demandId);

     const detailsDiv = document.querySelector(`.daytoday-demand-list li.list-group-item[data-id="${demandId}"] .daytoday-step-details`);


     const loggedInUserString = sessionStorage.getItem('loggedInUser');
     const loggedInUser = loggedInUserString ? JSON.parse(loggedInUserString) : null;
     const userEmail = loggedInUser ? loggedInUser.email : null;


     if (!demand || !detailsDiv) {
          console.error("Erro ao renderizar etapas Dia a Dia: Demanda ou detalhes não encontrados.", { demandId, demandExists: !!demand, detailsDivExists: !!detailsDiv });
          if (detailsDiv) detailsDiv.innerHTML = '<p class="text-muted">Erro ao carregar etapas.</p>';
          return;
     }

     detailsDiv.innerHTML = `
          <h5>Etapas da Demanda:</h5>
          <div class="daytoday-add-step-button-container">
              <button class="btn btn-sm daytoday-add-step-button" data-demand-id="${demandId}">
                  <i class="bi bi-plus-circle"></i> Adicionar Etapa
              </button>
          </div>
          <ul class="list-group daytoday-step-list">
              <!-- Steps will be rendered here -->
          </ul>
     `;
     const updatedStepListEl = detailsDiv.querySelector('.daytoday-step-list');


     const steps = demand.steps || [];

      if (steps.length === 0) {
          updatedStepListEl.innerHTML = '<li class="list-group-item text-muted text-center">Nenhuma etapa registrada para esta demanda.</li>';
      } else {
         steps.sort((a, b) => new Date(a.date) - new Date(b.date));

         steps.forEach(step => {
              if (!step.acknowledgedBy) step.acknowledgedBy = {};
              if (!step.files) step.files = {};

             const displayDate = step.date ? new Date(step.date + 'T00:00:00').toLocaleDateString('pt-BR') : 'Data não informada';

              const isAcknowledged = userEmail && step.acknowledgedBy[userEmail] === true;
              const cienciaButtonClass = isAcknowledged ? 'btn-ciencia-acknowledged' : 'btn-ciencia-pending';
              const cienciaButtonText = isAcknowledged ? 'Ciente' : 'Ciência';
              const cienciaButtonIcon = isAcknowledged ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill';

              const filesArray = step.files ? Object.values(step.files) : [];
              const fileListHtml = filesArray.length > 0
                  ? `<ul class="daytoday-step-files-list">${filesArray.map(file => `<li><i class="bi bi-file-earmark"></i> ${file.name}</li>`).join('')}</ul>`
                  : '';


             const listItem = document.createElement('li');
             listItem.classList.add('list-group-item', 'daytoday-step-item');
             listItem.setAttribute('data-id', step.id);
             listItem.setAttribute('data-demand-id', demand.id);

             listItem.innerHTML = `
                  <div class="daytoday-step-item-content">
                      <strong>Etapa (${displayDate}):</strong>
                      <div class="daytoday-step-description">${step.description || 'Sem descrição'}</div>
                      ${fileListHtml}
                  </div>
                  <div class="daytoday-step-actions btn-group btn-group-sm">
                      ${userEmail ? `<button class="btn btn-ciencia ${cienciaButtonClass}" data-id="${step.id}" data-demand-id="${demand.id}" data-type="daytoday" title="${cienciaButtonText}"><i class="bi ${cienciaButtonIcon}"></i></button>` : ''}
                      <button class="btn btn-outline-primary edit-daytoday-step-btn" data-id="${step.id}" data-demand-id="${demand.id}" title="Editar Etapa"><i class="bi bi-pencil"></i></button>
                      <button class="btn btn-outline-danger delete-daytoday-step-btn" data-id="${step.id}" data-demand-id="${demand.id}" title="Excluir Etapa"><i class="bi bi-trash"></i></button>
                  </div>
              `;
             updatedStepListEl.appendChild(listItem);
         });
      }
}


// Opens the modal for adding a Day to Day step
function openDaytodayStepModalForAdd(demandId) {
    if (daytodayStepModalInstance) {
         document.getElementById('daytodayStepForm').reset();
         document.getElementById('daytodayStepId').value = '';
         document.getElementById('daytodayStepDemandId').value = demandId;
         document.getElementById('daytodayStepModalLabel').textContent = 'Adicionar Etapa';

         const today = new Date().toISOString().split('T')[0];
         document.getElementById('daytodayStepDate').value = today;

          const currentFilesDiv = document.getElementById('daytodayStepCurrentFiles');
         if(currentFilesDiv) currentFilesDiv.innerHTML = 'Nenhum arquivo anexado.';

          // Set the assignedToRole select in the step modal to the demand's current role
         const demands = getFromLocalStorage('daytoday_demands');
         const demand = demands.find(d => d.id === demandId);
         const assignedToRoleSelect = document.getElementById('daytodayStepAssignedToRole');
         if (demand && assignedToRoleSelect) {
             assignedToRoleSelect.value = demand.assignedToRole || assignedToOptions[0];
         } else if (assignedToRoleSelect && assignedToRoleSelect.options.length > 0) {
              assignedToRoleSelect.value = assignedToOptions[0];
         }


         daytodayStepModalInstance.show();
    }
}

// Opens the modal for editing a Day to Day step
function openDaytodayStepModalForEdit(demandId, stepId) {
    const demands = getFromLocalStorage('daytoday_demands');
    const demand = demands.find(d => d.id === demandId);
    const step = demand ? demand.steps.find(s => s.id === stepId) : null;

    if (step && daytodayStepModalInstance) {
        document.getElementById('daytodayStepId').value = step.id;
        document.getElementById('daytodayStepDemandId').value = demandId;
        document.getElementById('daytodayStepDescription').value = step.description || '';
        document.getElementById('daytodayStepDate').value = step.date || '';

         const currentFilesDiv = document.getElementById('daytodayStepCurrentFiles');
         if (currentFilesDiv) {
             const filesArray = step.files ? Object.values(step.files) : [];
             if (filesArray.length > 0) {
                  currentFilesDiv.innerHTML = 'Arquivos atuais: ' + filesArray.map(f => `<span title="${f.name} (${(f.size / 1024).toFixed(1)} KB)">${f.name}</span>`).join(', ');
             } else {
                  currentFilesDiv.innerHTML = 'Nenhum arquivo anexado.';
             }
         }

         // Set the assignedToRole select in the step modal to the demand's current role
         const assignedToRoleSelect = document.getElementById('daytodayStepAssignedToRole');
         if (demand && assignedToRoleSelect) {
             assignedToRoleSelect.value = demand.assignedToRole || assignedToOptions[0];
         } else if (assignedToRoleSelect && assignedToRoleSelect.options.length > 0) {
              assignedToRoleSelect.value = assignedToOptions[0];
         }


        document.getElementById('daytodayStepModalLabel').textContent = 'Editar Etapa';
        daytodayStepModalInstance.show();
    } else {
         console.error('Etapa ou demanda Dia a Dia não encontrada para edição:', { demandId, stepId });
    }
}

// Handles submission of the Day to Day step form
async function handleDaytodayStepSubmit(event) {
    event.preventDefault();
    const stepId = document.getElementById('daytodayStepId').value;
    const demandId = document.getElementById('daytodayStepDemandId').value;
    const description = document.getElementById('daytodayStepDescription').value.trim();
    const date = document.getElementById('daytodayStepDate').value;
    const filesInput = document.getElementById('daytodayStepFiles');
    const files = filesInput.files;
    const assignedToRoleFromStepModal = document.getElementById('daytodayStepAssignedToRole').value;


    if (!demandId || !description || !date || !assignedToRoleFromStepModal) {
        alert('Por favor, preencha os campos obrigatórios (Descrição, Data, Atribuído a).');
        return;
    }

    let demands = getFromLocalStorage('daytoday_demands');
    const demandIndex = demands.findIndex(d => d.id === demandId);

    if (demandIndex === -1) {
        console.error('Demanda pai não encontrada para a etapa.');
        return;
    }

    const demand = demands[demandIndex];
    if (!demand.steps) demand.steps = [];
     if (!demand.acknowledgedBy) demand.acknowledgedBy = {};


    const currentTimestamp = new Date().toISOString();

     let newFilesMetadata = {};
     for (let i = 0; i < files.length; i++) {
         const file = files[i];
         const fileId = Date.now().toString() + '_' + i;
         newFilesMetadata[fileId] = {
              id: fileId,
              name: file.name,
              type: file.type,
              size: file.size,
         };
     }


    if (stepId) { // Editing existing step
        const stepIndex = demand.steps.findIndex(s => s.id === stepId);
        if (stepIndex > -1) {
             const existingFiles = demand.steps[stepIndex].files || {};
            demand.steps[stepIndex] = {
                ...demand.steps[stepIndex],
                description,
                date,
                files: { ...existingFiles, ...newFilesMetadata },
                timestamp: currentTimestamp
            };
             if (!demand.steps[stepIndex].acknowledgedBy) demand.steps[stepIndex].acknowledgedBy = {};
        } else {
             console.error('Etapa não encontrada na demanda pai para edição.');
             return;
        }
    } else { // Adding new step
        const newStep = {
            id: Date.now().toString(),
            description,
            date,
            files: newFilesMetadata,
            timestamp: currentTimestamp,
            acknowledgedBy: {}
        };
        demand.steps.push(newStep);
    }

    // Update the parent demand's assignedToRole with the value from the step modal
    demand.assignedToRole = assignedToRoleFromStepModal;

    saveToLocalStorage('daytoday_demands', demands);

    if (daytodayStepModalInstance) daytodayStepModalInstance.hide();

    renderDaytodaySteps(demandId);
    const currentPage = window.location.pathname;
     if (currentPage.includes('daytoday_details.html')) {
         renderDaytodayLists(['Pendente', 'Em andamento', 'Cancelado']);
     } else if (currentPage.includes('completed_demands.html')) {
          renderDaytodayLists(['Concluído']);
     }


    populateDashboardCards();
}


// Handles deletion of a Day to Day demand
function deleteDaytodayDemand(demandId) {
     if (confirm('Tem certeza que deseja excluir esta demanda e todas as suas etapas?')) {
         let demands = getFromLocalStorage('daytoday_demands');
         demands = demands.filter(d => d.id !== demandId);

         saveToLocalStorage('daytoday_demands', demands);

         const currentPage = window.location.pathname;
          if (currentPage.includes('daytoday_details.html')) {
              renderDaytodayLists(['Pendente', 'Em andamento', 'Cancelado']);
          } else if (currentPage.includes('completed_demands.html')) {
               renderDaytodayLists(['Concluído']);
          }


         populateDashboardCards();
     }
}

// Handles deletion of a Day to Day step
function deleteDaytodayStep(demandId, stepId) {
     if (confirm('Tem certeza que deseja excluir esta etapa?')) {
         let demands = getFromLocalStorage('daytoday_demands');
         const demandIndex = demands.findIndex(d => d.id === demandId);

         if (demandIndex === -1) {
             console.error('Demanda pai não encontrada para excluir etapa.');
             return;
         }

         const demand = demands[demandIndex];
         if (!demand.steps) demand.steps = [];

         demand.steps = demand.steps.filter(s => s.id !== stepId);

         saveToLocalStorage('daytoday_demands', demands);

         renderDaytodaySteps(demandId);

         populateDashboardCards();
     }
}

// Marks Day to Day demand as acknowledged for the logged-in user (CREATOR ONLY)
function handleAcknowledgeDaytodayDemand(demandId) {
     const loggedInUserString = sessionStorage.getItem('loggedInUser');
     const loggedInUser = loggedInUserString ? JSON.parse(loggedInUserString) : null;
     const userEmail = loggedInUser ? loggedInUser.email : null;

     if (!userEmail) {
         alert("Você precisa estar logado para dar ciência.");
         return;
     }

     let demands = getFromLocalStorage('daytoday_demands');
     const demand = demands.find(d => d.id === demandId);

     if (demand && demand.createdByEmail === userEmail) {
         if (!demand.acknowledgedBy) demand.acknowledgedBy = {};

         const currentState = demand.acknowledgedBy[userEmail] === true;
         demand.acknowledgedBy[userEmail] = !currentState;

         saveToLocalStorage('daytoday_demands', demands);

         const currentPage = window.location.pathname;
          if (currentPage.includes('daytoday_details.html')) {
              renderDaytodayLists(['Pendente', 'Em andamento', 'Cancelado']);
         } else if (currentPage.includes('completed_demands.html')) {
              renderDaytodayLists(['Concluído']);
         } else if (currentPage.includes('dashboard.html')) {
             renderPendingItemsList();
         }

         populateDashboardCards();
     } else {
         console.error("Demanda Dia a Dia não encontrada ou usuário não é o criador:", demandId);
     }
}

// Marks Day to Day step as acknowledged for the logged-in user
function handleAcknowledgeDaytodayStep(demandId, stepId) {
     const loggedInUserString = sessionStorage.getItem('loggedInUser');
     const loggedInUser = loggedInUserString ? JSON.parse(loggedInUserString) : null;
     const userEmail = loggedInUser ? loggedInUser.email : null;

     if (!userEmail) {
         alert("Você precisa estar logado para dar ciência.");
         return;
     }

     let demands = getFromLocalStorage('daytoday_demands');
     const demandIndex = demands.findIndex(d => d.id === demandId);

     if (demandIndex === -1) {
         console.error("Demanda pai da etapa não encontrada:", demandId);
         return;
     }

     const demand = demands[demandIndex];
     const step = demand.steps ? demand.steps.find(s => s.id === stepId) : null;

     if (step) {
         if (!step.acknowledgedBy) step.acknowledgedBy = {};

         const currentState = step.acknowledgedBy[userEmail] === true;
         step.acknowledgedBy[userEmail] = !currentState;

         saveToLocalStorage('daytoday_demands', demands);

         const currentPage = window.location.pathname;
          if (currentPage.includes('daytoday_details.html') || currentPage.includes('completed_demands.html')) {
              renderDaytodaySteps(demandId);
         } else if (currentPage.includes('dashboard.html')) {
             renderPendingItemsList();
         }

         populateDashboardCards();
     } else {
         console.error("Etapa de Demanda Dia a Dia não encontrada para dar ciência:", { demandId, stepId });
     }
}