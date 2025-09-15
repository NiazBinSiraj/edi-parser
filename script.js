// Page Navigation System
class PageManager {
    constructor() {
        this.currentPage = 'home';
        this.pages = ['home', 'edi837'];
        this.initializeNavigation();
        this.initializeMobileMenu();
    }

    initializeNavigation() {
        // Navigation item click handlers
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = e.currentTarget.getAttribute('data-page');
                
                // Skip disabled items (EDI 835)
                if (e.currentTarget.classList.contains('cursor-not-allowed')) {
                    return;
                }
                
                this.navigateToPage(page);
            });
        });
    }

    initializeMobileMenu() {
        const mobileMenuBtn = document.getElementById('mobileMenuBtn');
        const sidebar = document.getElementById('sidebar');
        const mobileOverlay = document.getElementById('mobileOverlay');

        mobileMenuBtn?.addEventListener('click', () => {
            sidebar.classList.add('open');
            mobileOverlay.classList.add('show');
        });

        mobileOverlay?.addEventListener('click', () => {
            sidebar.classList.remove('open');
            mobileOverlay.classList.remove('show');
        });

        // Close mobile menu when navigation item is clicked
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                sidebar.classList.remove('open');
                mobileOverlay.classList.remove('show');
            });
        });
    }

    navigateToPage(pageId) {
        if (!this.pages.includes(pageId)) {
            console.warn(`Page ${pageId} not found`);
            return;
        }

        // Update current page
        this.currentPage = pageId;

        // Hide all pages
        document.querySelectorAll('.page').forEach(page => {
            page.classList.add('hidden');
            page.classList.remove('active');
        });

        // Show target page
        const targetPage = document.getElementById(`${pageId}Page`);
        if (targetPage) {
            targetPage.classList.remove('hidden');
            targetPage.classList.add('active');
        }

        // Update navigation active state
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });

        const activeNavItem = document.querySelector(`[data-page="${pageId}"]`);
        if (activeNavItem) {
            activeNavItem.classList.add('active');
        }

        // Clear EDI 837 results when navigating away
        if (pageId !== 'edi837') {
            this.clearEDI837Results();
        }

        // Update page title
        this.updatePageTitle(pageId);
    }

    clearEDI837Results() {
        const resultsSection = document.getElementById('resultsSection');
        const errorDisplay = document.getElementById('errorDisplay');
        const ediInput = document.getElementById('ediInput');
        
        if (resultsSection) resultsSection.classList.add('hidden');
        if (errorDisplay) errorDisplay.classList.add('hidden');
        if (ediInput) ediInput.value = '';
    }

    updatePageTitle(pageId) {
        const titles = {
            home: 'EDI Parser Suite - Healthcare Claims & Remittance Viewer',
            edi837: 'EDI 837 Parser - Healthcare Claims Viewer',
            edi835: 'EDI 835 Parser - Healthcare Remittance Viewer'
        };
        document.title = titles[pageId] || titles.home;
    }

    getCurrentPage() {
        return this.currentPage;
    }
}

// Global navigation function for onclick handlers
function navigateToPage(pageId) {
    if (window.pageManager) {
        window.pageManager.navigateToPage(pageId);
    }
}

class EDI837Parser {
    constructor() {
        this.segmentDelimiter = '~';
        this.elementDelimiter = '*';
        this.subElementDelimiter = '^';
        this.segments = [];
        this.parsedData = {};
    }

    parse(ediData) {
        try {
            // Clean and normalize the data
            const cleanData = this.cleanData(ediData);
            
            // Split into segments
            this.segments = cleanData.split(this.segmentDelimiter)
                .map(segment => segment.trim())
                .filter(segment => segment.length > 0);

            if (this.segments.length === 0) {
                throw new Error('No valid EDI segments found');
            }

            // Initialize parsed data structure
            this.parsedData = {
                interchange: {},
                groups: [],
                claims: [],
                providers: [],
                subscribers: [],
                patients: [],
                services: []
            };

            // Parse segments
            this.parseSegments();
            
            return this.parsedData;
        } catch (error) {
            throw new Error(`Parsing failed: ${error.message}`);
        }
    }

    cleanData(data) {
        // Remove extra whitespace and normalize line endings
        return data.replace(/\r\n/g, '\n')
                  .replace(/\r/g, '\n')
                  .replace(/\n/g, '')
                  .trim();
    }

    parseSegments() {
        let currentClaim = null;
        let currentSubscriber = null;
        let currentPatient = null;
        let currentProvider = null;

        for (let i = 0; i < this.segments.length; i++) {
            const segment = this.segments[i];
            const elements = segment.split(this.elementDelimiter);
            const segmentId = elements[0];

            try {
                switch (segmentId) {
                    case 'ISA':
                        this.parseISA(elements);
                        break;
                    case 'GS':
                        this.parseGS(elements);
                        break;
                    case 'ST':
                        this.parseST(elements);
                        break;
                    case 'BHT':
                        this.parseBHT(elements);
                        break;
                    case 'NM1':
                        const entityType = this.parseNM1(elements);
                        if (entityType.type === 'subscriber') {
                            currentSubscriber = entityType;
                            this.parsedData.subscribers.push(entityType);
                        } else if (entityType.type === 'patient') {
                            currentPatient = entityType;
                            this.parsedData.patients.push(entityType);
                        } else if (entityType.type === 'provider') {
                            currentProvider = entityType;
                            this.parsedData.providers.push(entityType);
                        }
                        break;
                    case 'PRV':
                        this.parsePRV(elements, currentProvider);
                        break;
                    case 'DMG':
                        this.parseDMG(elements, currentSubscriber || currentPatient);
                        break;
                    case 'REF':
                        this.parseREF(elements);
                        break;
                    case 'PER':
                        this.parsePER(elements);
                        break;
                    case 'CLM':
                        currentClaim = this.parseCLM(elements);
                        this.parsedData.claims.push(currentClaim);
                        break;
                    case 'DTP':
                        this.parseDTP(elements, currentClaim);
                        break;
                    case 'SV1':
                        const service = this.parseSV1(elements);
                        this.parsedData.services.push(service);
                        if (currentClaim) {
                            if (!currentClaim.services) currentClaim.services = [];
                            currentClaim.services.push(service);
                        }
                        break;
                    case 'N3':
                        this.parseN3(elements);
                        break;
                    case 'N4':
                        this.parseN4(elements);
                        break;
                    case 'SBR':
                        this.parseSBR(elements);
                        break;
                    case 'HI':
                        this.parseHI(elements, currentClaim);
                        break;
                    case 'LX':
                        this.parseLX(elements);
                        break;
                    case 'SE':
                        this.parseSE(elements);
                        break;
                    case 'GE':
                        this.parseGE(elements);
                        break;
                    case 'IEA':
                        this.parseIEA(elements);
                        break;
                }
            } catch (segmentError) {
                console.warn(`Error parsing segment ${segmentId}:`, segmentError.message);
            }
        }
    }

    parseISA(elements) {
        this.parsedData.interchange = {
            authorizationQualifier: elements[1],
            authorizationInfo: elements[2],
            securityQualifier: elements[3],
            securityInfo: elements[4],
            senderQualifier: elements[5],
            senderId: elements[6],
            receiverQualifier: elements[7],
            receiverId: elements[8],
            date: elements[9],
            time: elements[10],
            repetitionSeparator: elements[11],
            versionNumber: elements[12],
            controlNumber: elements[13],
            acknowledgmentRequested: elements[14],
            testIndicator: elements[15]
        };
    }

    parseGS(elements) {
        const group = {
            functionalCode: elements[1],
            applicationSender: elements[2],
            applicationReceiver: elements[3],
            date: elements[4],
            time: elements[5],
            controlNumber: elements[6],
            responsibleAgency: elements[7],
            version: elements[8]
        };
        this.parsedData.groups.push(group);
    }

    parseST(elements) {
        this.parsedData.transactionSet = {
            type: elements[1],
            controlNumber: elements[2],
            implementationGuide: elements[3]
        };
    }

    parseBHT(elements) {
        this.parsedData.beginningTransaction = {
            hierarchicalStructure: elements[1],
            transactionPurpose: elements[2],
            referenceId: elements[3],
            date: elements[4],
            time: elements[5],
            transactionType: elements[6]
        };
    }

    parseNM1(elements) {
        const entityTypeCode = elements[1];
        const entityType = this.getEntityType(entityTypeCode);
        
        return {
            type: entityType,
            entityTypeCode: entityTypeCode,
            entityType: elements[2],
            lastName: elements[3],
            firstName: elements[4],
            middleName: elements[5],
            namePrefix: elements[6],
            nameSuffix: elements[7],
            identificationQualifier: elements[8],
            identificationCode: elements[9]
        };
    }

    getEntityType(code) {
        const entityTypes = {
            '85': 'billing_provider',
            'IL': 'subscriber',
            'QC': 'patient',
            'PR': 'payer',
            '82': 'rendering_provider',
            '77': 'service_facility',
            'DN': 'referring_provider'
        };
        return entityTypes[code] || code;
    }

    parsePRV(elements, provider) {
        if (provider) {
            provider.providerCode = elements[1];
            provider.referenceIdQualifier = elements[2];
            provider.referenceId = elements[3];
        }
    }

    parseDMG(elements, entity) {
        if (entity) {
            entity.demographics = {
                dateFormat: elements[1],
                birthDate: elements[2],
                gender: elements[3]
            };
        }
    }

    parseREF(elements) {
        const reference = {
            qualifierCode: elements[1],
            referenceId: elements[2],
            description: elements[3]
        };
        
        if (!this.parsedData.references) {
            this.parsedData.references = [];
        }
        this.parsedData.references.push(reference);
    }

    parsePER(elements) {
        const contact = {
            contactFunctionCode: elements[1],
            name: elements[2],
            communicationNumberQualifier1: elements[3],
            communicationNumber1: elements[4],
            communicationNumberQualifier2: elements[5],
            communicationNumber2: elements[6]
        };
        
        if (!this.parsedData.contacts) {
            this.parsedData.contacts = [];
        }
        this.parsedData.contacts.push(contact);
    }

    parseCLM(elements) {
        return {
            claimId: elements[1],
            totalChargeAmount: elements[2],
            placeOfService: elements[5],
            providerSignatureIndicator: elements[6],
            assignmentOfBenefitsIndicator: elements[7],
            releaseOfInformationIndicator: elements[8],
            patientSignatureSourceCode: elements[9]
        };
    }

    parseDTP(elements, claim) {
        const dateInfo = {
            qualifier: elements[1],
            formatQualifier: elements[2],
            date: elements[3]
        };
        
        if (claim) {
            if (!claim.dates) claim.dates = [];
            claim.dates.push(dateInfo);
        }
    }

    parseSV1(elements) {
        return {
            serviceCode: elements[1],
            chargeAmount: elements[2],
            unitOfMeasure: elements[3],
            serviceUnits: elements[4],
            placeOfService: elements[5],
            diagnosisPointer: elements[7]
        };
    }

    parseN3(elements) {
        if (!this.parsedData.addresses) {
            this.parsedData.addresses = [];
        }
        
        this.parsedData.addresses.push({
            addressLine1: elements[1],
            addressLine2: elements[2]
        });
    }

    parseN4(elements) {
        const lastAddress = this.parsedData.addresses?.[this.parsedData.addresses.length - 1];
        if (lastAddress) {
            lastAddress.city = elements[1];
            lastAddress.state = elements[2];
            lastAddress.postalCode = elements[3];
            lastAddress.countryCode = elements[4];
        }
    }

    parseSBR(elements) {
        this.parsedData.subscriberInfo = {
            payerResponsibilitySequence: elements[1],
            individualRelationshipCode: elements[2],
            groupOrPolicyNumber: elements[3],
            groupName: elements[4],
            insuranceTypeCode: elements[5],
            coordinationOfBenefitsCode: elements[9]
        };
    }

    parseHI(elements, claim) {
        const healthInfo = {
            codeQualifier: elements[1]?.split(':')[0],
            code: elements[1]?.split(':')[1],
            dateQualifier: elements[2],
            date: elements[3]
        };
        
        if (claim) {
            if (!claim.healthInfo) claim.healthInfo = [];
            claim.healthInfo.push(healthInfo);
        }
    }

    parseLX(elements) {
        this.parsedData.serviceLineNumber = elements[1];
    }

    parseSE(elements) {
        this.parsedData.transactionSetTrailer = {
            segmentCount: elements[1],
            controlNumber: elements[2]
        };
    }

    parseGE(elements) {
        this.parsedData.functionalGroupTrailer = {
            transactionSetCount: elements[1],
            controlNumber: elements[2]
        };
    }

    parseIEA(elements) {
        this.parsedData.interchangeTrailer = {
            groupCount: elements[1],
            controlNumber: elements[2]
        };
    }
}

class EDIRenderer {
    constructor() {
        this.summaryCardsContainer = document.getElementById('summaryCards');
        this.parsedDataContainer = document.getElementById('parsedData');
    }

    render(parsedData) {
        this.renderSummaryCards(parsedData);
        this.renderDetailedData(parsedData);
    }

    renderSummaryCards(data) {
        const cards = [
            {
                title: 'Claims',
                count: data.claims?.length || 0,
                icon: '📋',
                color: 'blue'
            },
            {
                title: 'Services',
                count: data.services?.length || 0,
                icon: '🏥',
                color: 'green'
            },
            {
                title: 'Providers',
                count: data.providers?.length || 0,
                icon: '👨‍⚕️',
                color: 'purple'
            },
            {
                title: 'Patients',
                count: data.subscribers?.length || 0,
                icon: '👤',
                color: 'indigo'
            }
        ];

        this.summaryCardsContainer.innerHTML = cards.map(card => `
            <div class="bg-white rounded-lg shadow-md p-6 border-l-4 border-${card.color}-500">
                <div class="flex items-center">
                    <div class="text-3xl mr-4">${card.icon}</div>
                    <div>
                        <div class="text-2xl font-bold text-gray-800">${card.count}</div>
                        <div class="text-sm text-gray-600">${card.title}</div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderDetailedData(data) {
        const sections = [];

        // Interchange Control Header
        if (data.interchange && Object.keys(data.interchange).length > 0) {
            sections.push(this.createSection('Interchange Control Header (ISA)', data.interchange, 'blue'));
        }

        // Functional Group Header
        if (data.groups && data.groups.length > 0) {
            data.groups.forEach((group, index) => {
                sections.push(this.createSection(`Functional Group ${index + 1} (GS)`, group, 'green'));
            });
        }

        // Transaction Set Header
        if (data.transactionSet) {
            sections.push(this.createSection('Transaction Set Header (ST)', data.transactionSet, 'purple'));
        }

        // Beginning of Hierarchical Transaction
        if (data.beginningTransaction) {
            sections.push(this.createSection('Beginning Transaction (BHT)', data.beginningTransaction, 'indigo'));
        }

        // Providers
        if (data.providers && data.providers.length > 0) {
            data.providers.forEach((provider, index) => {
                sections.push(this.createSection(`Provider ${index + 1} (NM1)`, provider, 'yellow'));
            });
        }

        // Subscribers
        if (data.subscribers && data.subscribers.length > 0) {
            data.subscribers.forEach((subscriber, index) => {
                sections.push(this.createSection(`Subscriber ${index + 1} (NM1)`, subscriber, 'pink'));
            });
        }

        // Patients
        if (data.patients && data.patients.length > 0) {
            data.patients.forEach((patient, index) => {
                sections.push(this.createSection(`Patient ${index + 1} (NM1)`, patient, 'red'));
            });
        }

        // Claims
        if (data.claims && data.claims.length > 0) {
            data.claims.forEach((claim, index) => {
                sections.push(this.createSection(`Claim ${index + 1} (CLM)`, claim, 'blue'));
            });
        }

        // Services
        if (data.services && data.services.length > 0) {
            data.services.forEach((service, index) => {
                sections.push(this.createSection(`Service ${index + 1} (SV1)`, service, 'green'));
            });
        }

        // References
        if (data.references && data.references.length > 0) {
            sections.push(this.createSection('References (REF)', data.references, 'gray'));
        }

        // Contacts
        if (data.contacts && data.contacts.length > 0) {
            sections.push(this.createSection('Contacts (PER)', data.contacts, 'teal'));
        }

        // Addresses
        if (data.addresses && data.addresses.length > 0) {
            sections.push(this.createSection('Addresses (N3/N4)', data.addresses, 'orange'));
        }

        this.parsedDataContainer.innerHTML = sections.join('');

        // Add fade-in animation
        this.parsedDataContainer.classList.add('fade-in');
    }

    createSection(title, data, color) {
        const isArray = Array.isArray(data);
        const items = isArray ? data : [data];

        return `
            <div class="bg-white rounded-lg shadow-lg overflow-hidden">
                <div class="segment-header px-6 py-4">
                    <h3 class="text-lg font-semibold text-white">${title}</h3>
                </div>
                <div class="p-6">
                    ${items.map((item, index) => `
                        ${isArray && items.length > 1 ? `<h4 class="text-md font-medium text-gray-700 mb-3">Item ${index + 1}</h4>` : ''}
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            ${this.renderDataFields(item)}
                        </div>
                        ${index < items.length - 1 ? '<hr class="my-4 border-gray-200">' : ''}
                    `).join('')}
                </div>
            </div>
        `;
    }

    renderDataFields(obj) {
        return Object.entries(obj)
            .filter(([key, value]) => value !== undefined && value !== null && value !== '')
            .map(([key, value]) => {
                const displayKey = this.formatFieldName(key);
                const displayValue = this.formatFieldValue(key, value);
                
                return `
                    <div class="bg-gray-50 p-3 rounded border">
                        <div class="text-xs font-medium text-gray-500 uppercase tracking-wide">${displayKey}</div>
                        <div class="mt-1 text-sm text-gray-900 break-words">${displayValue}</div>
                    </div>
                `;
            }).join('');
    }

    formatFieldName(key) {
        return key.replace(/([A-Z])/g, ' $1')
                 .replace(/^./, str => str.toUpperCase())
                 .trim();
    }

    formatFieldValue(key, value) {
        if (typeof value === 'object' && value !== null) {
            return `<pre class="code-block text-xs">${JSON.stringify(value, null, 2)}</pre>`;
        }

        // Format specific field types
        if (key.toLowerCase().includes('date') && /^\d{8}$/.test(value)) {
            const year = value.substring(0, 4);
            const month = value.substring(4, 6);
            const day = value.substring(6, 8);
            return `${month}/${day}/${year}`;
        }

        if (key.toLowerCase().includes('time') && /^\d{4}$/.test(value)) {
            const hour = value.substring(0, 2);
            const minute = value.substring(2, 4);
            return `${hour}:${minute}`;
        }

        if (key.toLowerCase().includes('amount')) {
            const num = parseFloat(value);
            return isNaN(num) ? value : `$${num.toFixed(2)}`;
        }

        return String(value);
    }
}

// Application Controller
class EDIApp {
    constructor() {
        this.parser = new EDI837Parser();
        this.renderer = new EDIRenderer();
        this.initializeEventListeners();
        this.initializeSampleData();
    }

    initializeEventListeners() {
        // Only add listeners if elements exist (EDI 837 page)
        const parseBtn = document.getElementById('parseBtn');
        const clearBtn = document.getElementById('clearBtn');
        const sampleBtn = document.getElementById('sampleBtn');
        const ediInput = document.getElementById('ediInput');

        if (parseBtn) parseBtn.addEventListener('click', () => this.parseEDI());
        if (clearBtn) clearBtn.addEventListener('click', () => this.clearData());
        if (sampleBtn) sampleBtn.addEventListener('click', () => this.loadSampleData());
        
        // Allow parsing with Ctrl+Enter
        if (ediInput) {
            ediInput.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.key === 'Enter') {
                    this.parseEDI();
                }
            });
        }
    }

    initializeSampleData() {
        this.sampleData = `ISA*00*          *00*          *ZZ*SUBMITTER_ID  *ZZ*RECEIVER_ID   *210315*1234*^*00501*000000001*0*P*>~GS*HC*SENDER*RECEIVER*20210315*1234*1*X*005010X222A1~ST*837*0001*005010X222A1~BHT*0019*00*0001*20210315*1234*CH~NM1*85*2*BILLING PROVIDER*****XX*1234567890~PRV*BI*PXC*207Q00000X~N3*123 MAIN STREET~N4*ANYTOWN*NY*12345~REF*EI*123456789~PER*IC*CONTACT NAME*TE*5551234567~NM1*87*2~N3*456 OAK AVENUE~N4*SOMEWHERE*CA*90210~HL*1**20*1~PRV*BI*PXC*207Q00000X~NM1*85*2*PROVIDER NAME*****XX*9876543210~HL*2*1*22*1~SBR*P*18*GROUP123****MB~NM1*IL*1*SMITH*JOHN*A***MI*123456789~DMG*D8*19800101*M~N3*789 ELM STREET~N4*HOMETOWN*TX*75001~REF*SY*123456789~HL*3*2*23*0~PAT*19~NM1*QC*1*DOE*JANE*B~DMG*D8*19950615*F~CLM*CLAIM001*150.00***11:B:1*Y*A*Y*I~DTP*431*D8*20210301~DTP*454*D8*20210301~REF*D9*DIAGNOSIS001~HI*BK:Z8701*BF:M7989~LX*1~SV1*HC:99213*75.00*UN*1***1~DTP*472*D8*20210301~LX*2~SV1*HC:90834*75.00*UN*1***2~DTP*472*D8*20210301~SE*30*0001~GE*1*1~IEA*1*000000001~`;
    }

    parseEDI() {
        const input = document.getElementById('ediInput')?.value?.trim();
        
        if (!input) {
            this.showError('Please enter EDI 837 data to parse.');
            return;
        }

        this.showLoading(true);
        this.hideError();
        this.hideResults();

        // Use setTimeout to allow UI to update
        setTimeout(() => {
            try {
                const parsedData = this.parser.parse(input);
                this.showResults(parsedData);
                this.showLoading(false);
            } catch (error) {
                this.showError(error.message);
                this.showLoading(false);
            }
        }, 100);
    }

    showResults(data) {
        this.renderer.render(data);
        const resultsSection = document.getElementById('resultsSection');
        if (resultsSection) {
            resultsSection.classList.remove('hidden');
            resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    clearData() {
        const ediInput = document.getElementById('ediInput');
        if (ediInput) ediInput.value = '';
        this.hideResults();
        this.hideError();
    }

    loadSampleData() {
        const ediInput = document.getElementById('ediInput');
        if (ediInput) ediInput.value = this.sampleData;
        this.hideResults();
        this.hideError();
    }

    showLoading(show) {
        const indicator = document.getElementById('loadingIndicator');
        const parseBtn = document.getElementById('parseBtn');
        
        if (!indicator || !parseBtn) return;
        
        if (show) {
            indicator.classList.remove('hidden');
            parseBtn.disabled = true;
            parseBtn.classList.add('parse-animation');
            parseBtn.textContent = 'Parsing...';
        } else {
            indicator.classList.add('hidden');
            parseBtn.disabled = false;
            parseBtn.classList.remove('parse-animation');
            parseBtn.textContent = 'Parse EDI 837';
        }
    }

    showError(message) {
        const errorMessage = document.getElementById('errorMessage');
        const errorDisplay = document.getElementById('errorDisplay');
        
        if (errorMessage && errorDisplay) {
            errorMessage.textContent = message;
            errorDisplay.classList.remove('hidden');
        }
    }

    hideError() {
        const errorDisplay = document.getElementById('errorDisplay');
        if (errorDisplay) errorDisplay.classList.add('hidden');
    }

    hideResults() {
        const resultsSection = document.getElementById('resultsSection');
        if (resultsSection) resultsSection.classList.add('hidden');
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize page manager
    window.pageManager = new PageManager();
    
    // Initialize EDI app
    window.ediApp = new EDIApp();
    
    // Set initial page
    window.pageManager.navigateToPage('home');
});
