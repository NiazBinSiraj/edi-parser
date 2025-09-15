// Page Navigation System
class PageManager {
    constructor() {
        this.currentPage = 'home';
        this.pages = ['home', 'edi837', 'edi835'];
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

        // Clear EDI results when navigating away
        if (pageId !== 'edi837') {
            this.clearEDI837Results();
        }
        if (pageId !== 'edi835') {
            this.clearEDI835Results();
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

    clearEDI835Results() {
        const resultsSection = document.getElementById('results835Section');
        const errorDisplay = document.getElementById('error835Display');
        const ediInput = document.getElementById('edi835Input');
        
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

// EDI 835 Parser Class for Healthcare Remittance Advice
class EDI835Parser {
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
                payments: [],
                claims: [],
                services: [],
                adjustments: [],
                references: [],
                contacts: [],
                addresses: []
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
        let currentPayment = null;
        let currentClaim = null;
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
                    case 'BPR':
                        currentPayment = this.parseBPR(elements);
                        this.parsedData.payments.push(currentPayment);
                        break;
                    case 'TRN':
                        this.parseTRN(elements, currentPayment);
                        break;
                    case 'REF':
                        this.parseREF(elements);
                        break;
                    case 'DTM':
                        this.parseDTM(elements, currentPayment);
                        break;
                    case 'N1':
                        currentProvider = this.parseN1(elements);
                        break;
                    case 'N3':
                        this.parseN3(elements);
                        break;
                    case 'N4':
                        this.parseN4(elements);
                        break;
                    case 'PER':
                        this.parsePER(elements);
                        break;
                    case 'CLP':
                        currentClaim = this.parseCLP(elements);
                        this.parsedData.claims.push(currentClaim);
                        if (currentPayment) {
                            if (!currentPayment.claims) currentPayment.claims = [];
                            currentPayment.claims.push(currentClaim);
                        }
                        break;
                    case 'CAS':
                        this.parseCAS(elements, currentClaim);
                        break;
                    case 'NM1':
                        this.parseNM1(elements, currentClaim);
                        break;
                    case 'MIA':
                        this.parseMIA(elements, currentClaim);
                        break;
                    case 'MOA':
                        this.parseMOA(elements, currentClaim);
                        break;
                    case 'SVC':
                        const service = this.parseSVC(elements);
                        this.parsedData.services.push(service);
                        if (currentClaim) {
                            if (!currentClaim.services) currentClaim.services = [];
                            currentClaim.services.push(service);
                        }
                        break;
                    case 'DTM_SVC':
                        this.parseDTMService(elements);
                        break;
                    case 'AMT':
                        this.parseAMT(elements, currentClaim);
                        break;
                    case 'QTY':
                        this.parseQTY(elements, currentClaim);
                        break;
                    case 'PLB':
                        const adjustment = this.parsePLB(elements);
                        this.parsedData.adjustments.push(adjustment);
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

    parseBPR(elements) {
        return {
            transactionHandlingCode: elements[1],
            totalPremiumPaymentAmount: elements[2],
            creditDebitFlag: elements[3],
            paymentMethodCode: elements[4],
            paymentFormatCode: elements[5],
            senderDFIIdQualifier: elements[6],
            senderDFIId: elements[7],
            senderAccountQualifier: elements[8],
            senderAccountNumber: elements[9],
            originatingCompanyId: elements[10],
            originatingCompanySupplementalCode: elements[11],
            receiverDFIIdQualifier: elements[12],
            receiverDFIId: elements[13],
            receiverAccountQualifier: elements[14],
            receiverAccountNumber: elements[15],
            effectiveEntryDate: elements[16]
        };
    }

    parseTRN(elements, payment) {
        const traceNumber = {
            traceTypeCode: elements[1],
            traceNumber: elements[2],
            originatingCompanyId: elements[3],
            referenceId: elements[4]
        };
        
        if (payment) {
            payment.traceNumber = traceNumber;
        }
    }

    parseREF(elements) {
        const reference = {
            qualifierCode: elements[1],
            referenceId: elements[2],
            description: elements[3]
        };
        this.parsedData.references.push(reference);
    }

    parseDTM(elements, payment) {
        const dateInfo = {
            qualifier: elements[1],
            date: elements[2],
            time: elements[3],
            timeCode: elements[4]
        };
        
        if (payment) {
            if (!payment.dates) payment.dates = [];
            payment.dates.push(dateInfo);
        }
    }

    parseN1(elements) {
        return {
            entityIdentifierCode: elements[1],
            name: elements[2],
            identificationCodeQualifier: elements[3],
            identificationCode: elements[4]
        };
    }

    parseN3(elements) {
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

    parsePER(elements) {
        const contact = {
            contactFunctionCode: elements[1],
            name: elements[2],
            communicationNumberQualifier1: elements[3],
            communicationNumber1: elements[4],
            communicationNumberQualifier2: elements[5],
            communicationNumber2: elements[6]
        };
        this.parsedData.contacts.push(contact);
    }

    parseCLP(elements) {
        return {
            claimSubmitterIdentifier: elements[1],
            claimStatusCode: elements[2],
            totalClaimChargeAmount: elements[3],
            claimPaymentAmount: elements[4],
            patientResponsibilityAmount: elements[5],
            claimFilingIndicatorCode: elements[6],
            payerClaimControlNumber: elements[7],
            facilityTypeCode: elements[8],
            claimFrequencyCode: elements[9]
        };
    }

    parseCAS(elements, claim) {
        const adjustment = {
            claimAdjustmentGroupCode: elements[1],
            adjustmentReasonCode1: elements[2],
            adjustmentAmount1: elements[3],
            adjustmentQuantity1: elements[4],
            adjustmentReasonCode2: elements[5],
            adjustmentAmount2: elements[6],
            adjustmentQuantity2: elements[7]
        };
        
        if (claim) {
            if (!claim.adjustments) claim.adjustments = [];
            claim.adjustments.push(adjustment);
        }
    }

    parseNM1(elements, claim) {
        const entity = {
            entityIdentifierCode: elements[1],
            entityTypeQualifier: elements[2],
            lastName: elements[3],
            firstName: elements[4],
            middleName: elements[5],
            namePrefix: elements[6],
            nameSuffix: elements[7],
            identificationCodeQualifier: elements[8],
            identificationCode: elements[9]
        };
        
        if (claim) {
            if (!claim.entities) claim.entities = [];
            claim.entities.push(entity);
        }
    }

    parseMIA(elements, claim) {
        if (claim) {
            claim.inpatientAdjudication = {
                coveredDays: elements[1],
                ppsOperatingOutlierAmount: elements[2],
                lifetimeReserveDays: elements[3],
                coinsuranceDays: elements[4],
                nonCoveredDays: elements[5],
                totalDeductibleAmount: elements[6],
                totalCoinsuranceAmount: elements[7],
                accommodationTotalAmount: elements[8],
                otherMedicalServiceTotalAmount: elements[9]
            };
        }
    }

    parseMOA(elements, claim) {
        if (claim) {
            claim.outpatientAdjudication = {
                reimbursementRate: elements[1],
                hcpcsPayableAmount: elements[2],
                remarkCode1: elements[3],
                remarkCode2: elements[4],
                remarkCode3: elements[5],
                remarkCode4: elements[6],
                remarkCode5: elements[7],
                endStageRenalDiseasePaymentAmount: elements[8],
                nonPayableProfessionalComponentBilledAmount: elements[9]
            };
        }
    }

    parseSVC(elements) {
        return {
            serviceCode: elements[1],
            chargeAmount: elements[2],
            paymentAmount: elements[3],
            revenueCode: elements[4],
            paidUnits: elements[5],
            bundledUnits: elements[6]
        };
    }

    parseDTMService(elements) {
        return {
            qualifier: elements[1],
            date: elements[2]
        };
    }

    parseAMT(elements, claim) {
        const amount = {
            amountQualifierCode: elements[1],
            monetaryAmount: elements[2]
        };
        
        if (claim) {
            if (!claim.amounts) claim.amounts = [];
            claim.amounts.push(amount);
        }
    }

    parseQTY(elements, claim) {
        const quantity = {
            quantityQualifier: elements[1],
            quantity: elements[2]
        };
        
        if (claim) {
            if (!claim.quantities) claim.quantities = [];
            claim.quantities.push(quantity);
        }
    }

    parsePLB(elements) {
        return {
            providerIdentifier: elements[1],
            fiscalPeriodDate: elements[2],
            adjustmentIdentifier1: elements[3],
            providerAdjustmentAmount1: elements[4],
            adjustmentIdentifier2: elements[5],
            providerAdjustmentAmount2: elements[6]
        };
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

// EDI 835 Renderer Class
class EDI835Renderer {
    constructor() {
        this.summaryCardsContainer = document.getElementById('summary835Cards');
        this.parsedDataContainer = document.getElementById('parsed835Data');
    }

    render(parsedData) {
        this.renderSummaryCards(parsedData);
        this.renderDetailedData(parsedData);
    }

    renderSummaryCards(data) {
        const cards = [
            {
                title: 'Payments',
                count: data.payments?.length || 0,
                icon: '💰',
                color: 'green'
            },
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
                color: 'purple'
            },
            {
                title: 'Adjustments',
                count: data.adjustments?.length || 0,
                icon: '⚖️',
                color: 'orange'
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

        // Payment Information
        if (data.payments && data.payments.length > 0) {
            data.payments.forEach((payment, index) => {
                sections.push(this.createSection(`Payment ${index + 1} (BPR)`, payment, 'green'));
            });
        }

        // Claims
        if (data.claims && data.claims.length > 0) {
            data.claims.forEach((claim, index) => {
                sections.push(this.createSection(`Claim ${index + 1} (CLP)`, claim, 'blue'));
            });
        }

        // Services
        if (data.services && data.services.length > 0) {
            data.services.forEach((service, index) => {
                sections.push(this.createSection(`Service ${index + 1} (SVC)`, service, 'purple'));
            });
        }

        // Provider Adjustments
        if (data.adjustments && data.adjustments.length > 0) {
            data.adjustments.forEach((adjustment, index) => {
                sections.push(this.createSection(`Provider Adjustment ${index + 1} (PLB)`, adjustment, 'orange'));
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
            sections.push(this.createSection('Addresses (N3/N4)', data.addresses, 'indigo'));
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

        // Format specific field types for EDI 835
        if (key.toLowerCase().includes('date') && /^\d{8}$/.test(value)) {
            const year = value.substring(0, 4);
            const month = value.substring(4, 6);
            const day = value.substring(6, 8);
            return `${month}/${day}/${year}`;
        }

        if (key.toLowerCase().includes('date') && /^\d{6}$/.test(value)) {
            const year = '20' + value.substring(0, 2);
            const month = value.substring(2, 4);
            const day = value.substring(4, 6);
            return `${month}/${day}/${year}`;
        }

        if (key.toLowerCase().includes('time') && /^\d{4}$/.test(value)) {
            const hour = value.substring(0, 2);
            const minute = value.substring(2, 4);
            return `${hour}:${minute}`;
        }

        if (key.toLowerCase().includes('amount') || key.toLowerCase().includes('payment')) {
            const num = parseFloat(value);
            return isNaN(num) ? value : `$${num.toFixed(2)}`;
        }

        // Format claim status codes
        if (key === 'claimStatusCode') {
            const statusCodes = {
                '1': 'Processed as Primary',
                '2': 'Processed as Secondary',
                '3': 'Processed as Tertiary',
                '4': 'Denied',
                '19': 'Processed as Primary, Forwarded to Additional Payer(s)',
                '20': 'Processed as Secondary, Forwarded to Additional Payer(s)',
                '21': 'Processed as Tertiary, Forwarded to Additional Payer(s)',
                '22': 'Reversal of Previous Payment',
                '23': 'Not Our Claim, Forwarded to Additional Payer(s)',
                '25': 'Predetermination Pricing Only - No Payment'
            };
            return statusCodes[value] || value;
        }

        return String(value);
    }
}

// Application Controller
class EDIApp {
    constructor() {
        this.parser837 = new EDI837Parser();
        this.renderer837 = new EDIRenderer();
        this.parser835 = new EDI835Parser();
        this.renderer835 = new EDI835Renderer();
        this.initializeEventListeners();
        this.initializeSampleData();
    }

    initializeEventListeners() {
        // EDI 837 listeners
        const parseBtn = document.getElementById('parseBtn');
        const clearBtn = document.getElementById('clearBtn');
        const sampleBtn = document.getElementById('sampleBtn');
        const ediInput = document.getElementById('ediInput');

        if (parseBtn) parseBtn.addEventListener('click', () => this.parseEDI837());
        if (clearBtn) clearBtn.addEventListener('click', () => this.clearData837());
        if (sampleBtn) sampleBtn.addEventListener('click', () => this.loadSampleData837());
        
        // Allow parsing with Ctrl+Enter for EDI 837
        if (ediInput) {
            ediInput.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.key === 'Enter') {
                    this.parseEDI837();
                }
            });
        }

        // EDI 835 listeners
        const parse835Btn = document.getElementById('parse835Btn');
        const clear835Btn = document.getElementById('clear835Btn');
        const sample835Btn = document.getElementById('sample835Btn');
        const edi835Input = document.getElementById('edi835Input');

        if (parse835Btn) parse835Btn.addEventListener('click', () => this.parseEDI835());
        if (clear835Btn) clear835Btn.addEventListener('click', () => this.clearData835());
        if (sample835Btn) sample835Btn.addEventListener('click', () => this.loadSampleData835());
        
        // Allow parsing with Ctrl+Enter for EDI 835
        if (edi835Input) {
            edi835Input.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.key === 'Enter') {
                    this.parseEDI835();
                }
            });
        }
    }

    initializeSampleData() {
        this.sampleData837 = `ISA*00*          *00*          *ZZ*SUBMITTER_ID  *ZZ*RECEIVER_ID   *210315*1234*^*00501*000000001*0*P*>~GS*HC*SENDER*RECEIVER*20210315*1234*1*X*005010X222A1~ST*837*0001*005010X222A1~BHT*0019*00*0001*20210315*1234*CH~NM1*85*2*BILLING PROVIDER*****XX*1234567890~PRV*BI*PXC*207Q00000X~N3*123 MAIN STREET~N4*ANYTOWN*NY*12345~REF*EI*123456789~PER*IC*CONTACT NAME*TE*5551234567~NM1*87*2~N3*456 OAK AVENUE~N4*SOMEWHERE*CA*90210~HL*1**20*1~PRV*BI*PXC*207Q00000X~NM1*85*2*PROVIDER NAME*****XX*9876543210~HL*2*1*22*1~SBR*P*18*GROUP123****MB~NM1*IL*1*SMITH*JOHN*A***MI*123456789~DMG*D8*19800101*M~N3*789 ELM STREET~N4*HOMETOWN*TX*75001~REF*SY*123456789~HL*3*2*23*0~PAT*19~NM1*QC*1*DOE*JANE*B~DMG*D8*19950615*F~CLM*CLAIM001*150.00***11:B:1*Y*A*Y*I~DTP*431*D8*20210301~DTP*454*D8*20210301~REF*D9*DIAGNOSIS001~HI*BK:Z8701*BF:M7989~LX*1~SV1*HC:99213*75.00*UN*1***1~DTP*472*D8*20210301~LX*2~SV1*HC:90834*75.00*UN*1***2~DTP*472*D8*20210301~SE*30*0001~GE*1*1~IEA*1*000000001~`;
        
        this.sampleData835 = `ISA*00*          *00*          *ZZ*PAYER_ID     *ZZ*RECEIVER_ID   *210315*1234*^*00501*000000001*0*P*>~GS*HP*SENDER*RECEIVER*20210315*1234*1*X*005010X221A1~ST*835*0001*005010X221A1~BPR*I*150.00*C*ACH*CCD*01*999999999*DA*123456789*9999999999**01*999999999*DA*123456789*20210315~TRN*1*21030500001*9999999999*PAYMENT001~REF*EV*REMITTANCE001~DTM*405*20210315~N1*PR*HEALTH INSURANCE COMPANY*XX*12345~N3*PO BOX 12345~N4*ANYTOWN*NY*12345~PER*BL*CLAIMS*TE*8005551234~CLP*CLAIM001*1*150.00*125.00*25.00*MC*PAY001*11~CAS*CO*45*25.00~NM1*QC*1*DOE*JANE*B***MI*123456789~DTM*232*20210301~DTM*233*20210301~AMT*AU*125.00~SVC*HC:99213*75.00*65.00**1~DTM*472*20210301~CAS*CO*45*10.00~SVC*HC:90834*75.00*60.00**1~DTM*472*20210301~CAS*CO*45*15.00~PLB*1234567890*20210228*L6*-5.00~SE*25*0001~GE*1*1~IEA*1*000000001~`;
    }

    // EDI 837 Methods
    parseEDI837() {
        const input = document.getElementById('ediInput')?.value?.trim();
        
        if (!input) {
            this.showError837('Please enter EDI 837 data to parse.');
            return;
        }

        this.showLoading837(true);
        this.hideError837();
        this.hideResults837();

        // Use setTimeout to allow UI to update
        setTimeout(() => {
            try {
                const parsedData = this.parser837.parse(input);
                this.showResults837(parsedData);
                this.showLoading837(false);
            } catch (error) {
                this.showError837(error.message);
                this.showLoading837(false);
            }
        }, 100);
    }

    showResults837(data) {
        this.renderer837.render(data);
        const resultsSection = document.getElementById('resultsSection');
        if (resultsSection) {
            resultsSection.classList.remove('hidden');
            resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    clearData837() {
        const ediInput = document.getElementById('ediInput');
        if (ediInput) ediInput.value = '';
        this.hideResults837();
        this.hideError837();
    }

    loadSampleData837() {
        const ediInput = document.getElementById('ediInput');
        if (ediInput) ediInput.value = this.sampleData837;
        this.hideResults837();
        this.hideError837();
    }

    showLoading837(show) {
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

    showError837(message) {
        const errorMessage = document.getElementById('errorMessage');
        const errorDisplay = document.getElementById('errorDisplay');
        
        if (errorMessage && errorDisplay) {
            errorMessage.textContent = message;
            errorDisplay.classList.remove('hidden');
        }
    }

    hideError837() {
        const errorDisplay = document.getElementById('errorDisplay');
        if (errorDisplay) errorDisplay.classList.add('hidden');
    }

    hideResults837() {
        const resultsSection = document.getElementById('resultsSection');
        if (resultsSection) resultsSection.classList.add('hidden');
    }

    // EDI 835 Methods
    parseEDI835() {
        const input = document.getElementById('edi835Input')?.value?.trim();
        
        if (!input) {
            this.showError835('Please enter EDI 835 data to parse.');
            return;
        }

        this.showLoading835(true);
        this.hideError835();
        this.hideResults835();

        // Use setTimeout to allow UI to update
        setTimeout(() => {
            try {
                const parsedData = this.parser835.parse(input);
                this.showResults835(parsedData);
                this.showLoading835(false);
            } catch (error) {
                this.showError835(error.message);
                this.showLoading835(false);
            }
        }, 100);
    }

    showResults835(data) {
        this.renderer835.render(data);
        const resultsSection = document.getElementById('results835Section');
        if (resultsSection) {
            resultsSection.classList.remove('hidden');
            resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    clearData835() {
        const ediInput = document.getElementById('edi835Input');
        if (ediInput) ediInput.value = '';
        this.hideResults835();
        this.hideError835();
    }

    loadSampleData835() {
        const ediInput = document.getElementById('edi835Input');
        if (ediInput) ediInput.value = this.sampleData835;
        this.hideResults835();
        this.hideError835();
    }

    showLoading835(show) {
        const indicator = document.getElementById('loading835Indicator');
        const parseBtn = document.getElementById('parse835Btn');
        
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
            parseBtn.textContent = 'Parse EDI 835';
        }
    }

    showError835(message) {
        const errorMessage = document.getElementById('error835Message');
        const errorDisplay = document.getElementById('error835Display');
        
        if (errorMessage && errorDisplay) {
            errorMessage.textContent = message;
            errorDisplay.classList.remove('hidden');
        }
    }

    hideError835() {
        const errorDisplay = document.getElementById('error835Display');
        if (errorDisplay) errorDisplay.classList.add('hidden');
    }

    hideResults835() {
        const resultsSection = document.getElementById('results835Section');
        if (resultsSection) resultsSection.classList.add('hidden');
    }

    // Legacy methods for backward compatibility
    parseEDI() {
        this.parseEDI837();
    }

    showResults(data) {
        this.showResults837(data);
    }

    clearData() {
        this.clearData837();
    }

    loadSampleData() {
        this.loadSampleData837();
    }

    showLoading(show) {
        this.showLoading837(show);
    }

    showError(message) {
        this.showError837(message);
    }

    hideError() {
        this.hideError837();
    }

    hideResults() {
        this.hideResults837();
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
