// Global master state variables
let activeRole = 'Patient'; // Default simulation role
let currentTab = 'reception'; // Default staff tab

// Staff shift state variables
let staffId = '';
let staffName = '';
let qrToken = '';
let facilityId = '';
let facilityName = '';
let deviceLat = null;
let deviceLon = null;

// Cache lookups
let facilitiesMap = {};
let usersMap = {};
let staffMap = {};
let patientFacilitiesCache = [];

const patientTranslations = {
    en: {
        gateway_title: "Needan.ai",
        gateway_subtitle: "Gautam Buddha Nagar Medical Directory & Operations Gateway",
        gateway_tab_patient: "Patient Entry",
        gateway_tab_staff: "Staff Entry",
        gateway_tab_admin: "Admin Login",
        pat_name_label: "Patient Full Name *",
        pat_name_placeholder: "Enter your full name",
        pat_phone_label: "Contact Mobile Number *",
        pat_phone_placeholder: "e.g. +91 99999 88888",
        pat_submit: "Access Patient Directory",
        portal_patient_title: "Patient Portal",
        portal_patient_subtitle: "Register as a patient member or browse local centers diagnostic tests and bed availability.",
        portal_patient_exit: "Exit Portal",
        centers_header: "Available Centers & Live Beds",
        centers_refresh: "Refresh",
        search_placeholder: "Search for Medical Tests & Diagnostics...",
        beds_utilized: "Beds Utilized",
        available_physicians: "Available Physicians",
        available_diagnostics: "All Available Diagnostics",
        test_doctors_fallback: "test_data_xyz_doctors",
        test_tests_fallback: "test_data_xyz_tests",
        empty_state_text: "No medical centers registered in district network.",
        review_title: "Patient Reviews & Feedback",
        leave_review_title: "Leave a Review",
        rating_label: "Rating",
        comment_placeholder: "Write your review here...",
        submit_review_btn: "Submit Review",
        no_reviews_text: "No reviews left yet for this facility."
    },
    hi: {
        gateway_title: "Needan.ai",
        gateway_subtitle: "गौतम बुद्ध नगर चिकित्सा निर्देशिका और संचालन प्रवेश द्वार",
        gateway_tab_patient: "मरीज प्रवेश",
        gateway_tab_staff: "कर्मचारी प्रवेश",
        gateway_tab_admin: "एडमिन लॉगिन",
        pat_name_label: "मरीज का पूरा नाम *",
        pat_name_placeholder: "अपना पूरा नाम दर्ज करें",
        pat_phone_label: "संपर्क मोबाइल नंबर *",
        pat_phone_placeholder: "जैसे: +91 99999 88888",
        pat_submit: "मरीज निर्देशिका खोलें",
        portal_patient_title: "मरीज पोर्टल",
        portal_patient_subtitle: "मरीज सदस्य के रूप में पंजीकरण करें या स्थानीय केंद्रों के नैदानिक परीक्षण और बिस्तर उपलब्धता देखें।",
        portal_patient_exit: "पोर्टल से बाहर निकलें",
        centers_header: "उपलब्ध केंद्र और लाइव बेड",
        centers_refresh: "रिफ्रेश करें",
        search_placeholder: "चिकित्सा परीक्षण और निदान खोजें...",
        beds_utilized: "उपयोग किए गए बेड",
        available_physicians: "उपलब्ध चिकित्सक",
        available_diagnostics: "सभी उपलब्ध निदान",
        test_doctors_fallback: "जांच_डेटा_विशेषज्ञ_डॉक्टर",
        test_tests_fallback: "जांच_डेटा_विशेषज्ञ_परीक्षण",
        empty_state_text: "जिला नेटवर्क में कोई चिकित्सा केंद्र पंजीकृत नहीं है।",
        review_title: "मरीज की समीक्षा और प्रतिक्रिया",
        leave_review_title: "समीक्षा लिखें",
        rating_label: "रेटिंग",
        comment_placeholder: "अपनी समीक्षा यहाँ लिखें...",
        submit_review_btn: "समीक्षा सबमिट करें",
        no_reviews_text: "इस सुविधा के लिए अभी तक कोई समीक्षा नहीं छोड़ी गई है।"
    }
};

let currentPatientLang = localStorage.getItem('patientLang') || 'en';

window.applyPatientLanguage = function(lang) {
    currentPatientLang = lang;
    localStorage.setItem('patientLang', lang);
    
    const langTexts = document.querySelectorAll('.lang-toggle-text');
    langTexts.forEach(el => {
        el.innerText = lang === 'en' ? 'हिंदी' : 'English';
    });

    const dict = patientTranslations[lang];
    if (!dict) return;

    const translatableElements = document.querySelectorAll('[data-translate]');
    translatableElements.forEach(el => {
        const key = el.getAttribute('data-translate');
        if (dict[key]) {
            const icon = el.querySelector('i');
            if (icon) {
                const textNode = Array.from(el.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
                if (textNode) textNode.nodeValue = " " + dict[key];
            } else {
                el.innerText = dict[key];
            }
        }
    });

    const translatablePlaceholders = document.querySelectorAll('[data-translate-placeholder]');
    translatablePlaceholders.forEach(el => {
        const key = el.getAttribute('data-translate-placeholder');
        if (dict[key]) {
            el.setAttribute('placeholder', dict[key]);
        }
    });

    if (patientFacilitiesCache && patientFacilitiesCache.length > 0) {
        renderPatientFacilities(patientFacilitiesCache);
    }
}

window.togglePatientLanguage = function() {
    const nextLang = currentPatientLang === 'en' ? 'hi' : 'en';
    window.applyPatientLanguage(nextLang);
}

// On Page Load
document.addEventListener('DOMContentLoaded', () => {
    // Apply patient language config
    applyPatientLanguage(currentPatientLang);
    // Render Icons
    lucide.createIcons();
    
    // Wire staff terminal menu tabs
    const menuItems = document.querySelectorAll('.sidebar-menu .menu-item');
    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tabName = item.getAttribute('data-tab-target');
            switchTab(tabName);
        });
    });

    // Trap gateway forms explicitly to prevent reload loops
    ['gateway-patient-form', 'gateway-staff-form', 'gateway-admin-form'].forEach(id => {
        const form = document.getElementById(id);
        if (form) {
            form.addEventListener('submit', (e) => {
                if (e) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            });
        }
    });

    // 1. Fix the "Access Patient Directory" Button directly
    const patientSubmitBtn = document.querySelector('button[type="submit"]') || 
                             Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Access Patient Directory'));
    if (patientSubmitBtn) {
        patientSubmitBtn.setAttribute('type', 'button');
        patientSubmitBtn.onclick = function(e) {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            const nameField = document.getElementById('gate-pat-name');
            const phoneField = document.getElementById('gate-pat-phone');
            if (!nameField || !phoneField) return false;

            const authPayload = {
                username: nameField.value.trim(),
                phone: phoneField.value.trim()
            };

            fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(authPayload)
            })
            .then(res => res.json())
            .then(data => {
                if (data.success && data.user) {
                    localStorage.setItem('currentUser', JSON.stringify(data.user));
                    localStorage.setItem('activeRole', data.user.role);
                    transitionToDashboard();
                } else {
                    alert(data.message || "Credential authentication rejected.");
                }
            })
            .catch(error => {
                console.error("Critical Authentication Loop Crash:", error);
            });
            return false;
        };
    }

    // 1b. Fix the "Clock In Desk" Button directly
    const staffSubmitBtn = Array.from(document.querySelectorAll('#gateway-staff-form button')).find(el => el.textContent.includes('Clock In Desk'));
    if (staffSubmitBtn) {
        staffSubmitBtn.setAttribute('type', 'button');
        staffSubmitBtn.onclick = function(e) {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            window.handleStaffGatewayLogin(e);
            return false;
        };
    }

    // 1c. Fix the "Authenticate Terminal" Button directly
    const adminSubmitBtn = Array.from(document.querySelectorAll('#gateway-admin-form button')).find(el => el.textContent.includes('Authenticate Terminal'));
    if (adminSubmitBtn) {
        adminSubmitBtn.setAttribute('type', 'button');
        adminSubmitBtn.onclick = function(e) {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            window.handleAdminGatewayLogin(e);
            return false;
        };
    }

    // 2. Fix the "Bypass to Patient Portal" Button directly
    const patientBypassBtn = Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Bypass to Patient Portal'));
    if (patientBypassBtn) {
        patientBypassBtn.onclick = function(e) {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            localStorage.setItem('currentUser', JSON.stringify({ name: "Demo Patient", role: "Patient", phone: "9999999999" }));
            localStorage.setItem('activeRole', 'Patient');
            transitionToDashboard();
            return false;
        };
    }

    // 3. Centralized Transition Engine
    function transitionToDashboard() {
        const currentUserStr = localStorage.getItem('currentUser');
        const user = currentUserStr ? JSON.parse(currentUserStr) : {};
        const role = user.role || 'Patient';
        activeRole = role;

        const overlay = document.getElementById('gateway-overlay');
        if (overlay) overlay.style.setProperty('display', 'none', 'important');

        const pPatient = document.getElementById('portal-patient');
        const pAdmin = document.getElementById('portal-admin');
        const pStaff = document.getElementById('portal-staff');

        if (pPatient) pPatient.style.display = role === 'Patient' ? 'block' : 'none';
        if (pAdmin) pAdmin.style.display = role === 'Admin' ? 'block' : 'none';
        if (pStaff) pStaff.style.display = (role !== 'Patient' && role !== 'Admin') ? 'block' : 'none';

        if (role === 'Patient') {
            fetchPatientFacilities();
        } else if (role === 'Admin') {
            fetchAdminData();
        } else {
            staffId = localStorage.getItem('staffId') || user.id || '';
            qrToken = localStorage.getItem('qrToken') || '';
            facilityId = localStorage.getItem('facilityId') || user.facility_id || '';
            staffName = localStorage.getItem('staffName') || user.name || '';

            const authCont = document.getElementById('auth-container');
            if (authCont) authCont.style.display = 'none';

            const workspaceCont = document.getElementById('staff-workspace-container');
            if (workspaceCont) workspaceCont.style.display = 'flex';

            updateRoleState();
            switchTab(activeRole.toLowerCase() === 'staff' ? 'staff-dashboard' : activeRole.toLowerCase());
        }
    }

    // Run initial session checks
    checkSession();
});

// ==============================================
// 0. UNIFIED HEALTH GATEWAY LOGIN DESK
// ==============================================

window.showGatewayError = function(msg) {
    const errorDiv = document.getElementById('gateway-error-msg');
    const errorText = document.getElementById('gateway-error-text');
    if (errorDiv && errorText) {
        if (msg) {
            errorText.innerText = msg;
            errorDiv.style.display = 'flex';
        } else {
            errorDiv.style.display = 'none';
        }
    }
}

window.switchGatewayTab = function(tabName) {
    window.showGatewayError(null);
    const tabs = document.querySelectorAll('.gateway-tab-btn');
    tabs.forEach(tab => {
        if (tab.id === `tab-btn-${tabName}`) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    
    const panes = document.querySelectorAll('.gateway-form-pane');
    panes.forEach(pane => {
        if (pane.id === `pane-${tabName}`) {
            pane.classList.add('active');
        } else {
            pane.classList.remove('active');
        }
    });
}

window.checkBackdoorBypass = function(val) {
    if (val && val.trim().toUpperCase() === 'BYPASS') {
        triggerBypassAdmin();
    }
}

window.triggerBypassAdmin = function() {
    activeRole = 'Admin';
    localStorage.setItem('activeRole', 'Admin');
    localStorage.setItem('isAdminBypass', 'true');
    
    document.getElementById('gateway-overlay').style.display = 'none';
    
    const pPatient = document.getElementById('portal-patient');
    const pAdmin = document.getElementById('portal-admin');
    const pStaff = document.getElementById('portal-staff');
    
    pPatient.style.display = 'none';
    pAdmin.style.display = 'block';
    pStaff.style.display = 'none';
    
    fetchAdminData();
    showToast('Admin demonstration bypass unlocked!', 'success');
}

window.bypassToPortal = function(portalType, e) {
    if (e) e.preventDefault();
    const userMock = { name: "Demo User", role: portalType, phone: "9999999999" };
    localStorage.setItem('currentUser', JSON.stringify(userMock));
    localStorage.setItem('activeRole', portalType);
    activeRole = portalType;
    
    const overlay = document.getElementById('gateway-overlay');
    if (overlay) overlay.style.setProperty('display', 'none', 'important');
    
    const pPatient = document.getElementById('portal-patient');
    const pAdmin = document.getElementById('portal-admin');
    const pStaff = document.getElementById('portal-staff');
    
    if (pPatient) pPatient.style.display = portalType === 'Patient' ? 'block' : 'none';
    if (pAdmin) pAdmin.style.display = portalType === 'Admin' ? 'block' : 'none';
    if (pStaff) pStaff.style.display = portalType === 'Staff' ? 'block' : 'none';

    if (portalType === 'Patient') {
        fetchPatientFacilities();
    } else if (portalType === 'Admin') {
        fetchAdminData();
    }
    showToast(`Demo ${portalType} Bypass Activated.`, 'success');
}

window.bypassToStaff = async function(staffRoleType, e) {
    if (e) e.preventDefault();
    showToast(`Bypassing to ${staffRoleType} Workspace...`, 'info');
    
    let targetStaffId = 'STF_DOC'; // Doctor
    if (staffRoleType === 'Nurse') targetStaffId = 'STF_BISRAK_2'; 
    else if (staffRoleType === 'Pharmacist') targetStaffId = 'STF_PHARM';
    else if (staffRoleType === 'Reception') targetStaffId = 'STF_REC';

    try {
        const staff = await fetch('/api/staff', {
            headers: { 'X-Active-Role': 'Admin' }
        }).then(res => res.json());

        let targetStaff = staff.find(s => s.id === targetStaffId);
        if (!targetStaff) {
            targetStaff = staff.find(s => s.role.toLowerCase().includes(staffRoleType.toLowerCase()));
        }
        if (!targetStaff) {
            targetStaff = {
                id: targetStaffId,
                name: `Demo ${staffRoleType} Staff`,
                role: staffRoleType,
                facility_id: 'FAC_BISRAK'
            };
        }

        let facilities = await fetch('/api/facilities').then(res => res.json());
        let targetFacility = facilities.find(f => f.id === targetStaff.facility_id);
        if (!targetFacility) {
            targetFacility = facilities[0] || { id: 'FAC_BISRAK', name: 'Demo Clinic', daily_qr_token: 'QR_DEMO' };
        }

        let token = targetFacility.daily_qr_token;
        if (!token) {
            await fetch('/api/admin/generate-qr-tokens', {
                method: 'POST',
                headers: { 'X-Active-Role': 'Admin' }
            });
            facilities = await fetch('/api/facilities').then(res => res.json());
            targetFacility = facilities.find(f => f.id === targetStaff.facility_id) || facilities[0];
            token = targetFacility ? targetFacility.daily_qr_token : 'QR_DEMO';
        }

        deviceLat = 28.5983;
        deviceLon = 77.4332;

        staffId = targetStaff.id;
        qrToken = token;
        activeRole = staffRoleType; 
        facilityId = targetFacility.id;
        facilityName = targetFacility.name;
        staffName = targetStaff.name;

        const userObj = {
            id: staffId,
            name: staffName,
            role: activeRole,
            facility_id: facilityId
        };
        localStorage.setItem('currentUser', JSON.stringify(userObj));
        localStorage.setItem('staffId', staffId);
        localStorage.setItem('qrToken', qrToken);
        localStorage.setItem('activeRole', activeRole);
        localStorage.setItem('facilityId', facilityId);
        localStorage.setItem('facilityName', facilityName);
        localStorage.setItem('staffName', staffName);
        localStorage.setItem('deviceLat', String(deviceLat));
        localStorage.setItem('deviceLon', String(deviceLon));

        const overlay = document.getElementById('gateway-overlay');
        if (overlay) overlay.style.setProperty('display', 'none', 'important');
        
        const pPatient = document.getElementById('portal-patient');
        const pAdmin = document.getElementById('portal-admin');
        const pStaff = document.getElementById('portal-staff');
        
        if (pPatient) pPatient.style.display = 'none';
        if (pAdmin) pAdmin.style.display = 'none';
        if (pStaff) pStaff.style.display = 'block';

        const authCont = document.getElementById('auth-container');
        if (authCont) authCont.style.display = 'none';
        
        const workspaceCont = document.getElementById('staff-workspace-container');
        if (workspaceCont) workspaceCont.style.display = 'flex';

        updateRoleState();
        switchTab(activeRole.toLowerCase() === 'staff' ? 'staff-dashboard' : activeRole.toLowerCase());
        showToast(`Bypass Shift: Welcome, ${staffName}!`, 'success');
    } catch (err) {
        showToast(`Bypass failed: ${err.message}`, 'error');
    }
}

window.handlePatientGatewayLogin = function(e) {
    if (e) e.preventDefault();
    window.showGatewayError(null);
    const name = document.getElementById('gate-pat-name').value.trim();
    const phone = document.getElementById('gate-pat-phone').value.trim();

    fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, phone: phone })
    })
    .then(res => {
        if (!res.ok) throw new Error('Failed to login patient.');
        return res.json();
    })
    .then(data => {
        if (data.success && data.user) {
            localStorage.setItem('currentUser', JSON.stringify(data.user));
            localStorage.setItem('activeRole', data.user.role);
            
            const overlay = document.getElementById('gateway-overlay');
            if (overlay) overlay.style.setProperty('display', 'none', 'important');
            document.getElementById('portal-patient').style.display = 'block';
            document.getElementById('portal-admin').style.display = 'none';
            document.getElementById('portal-staff').style.display = 'none';

            activeRole = 'Patient';
            fetchPatientFacilities();
            showToast(`Welcome, Patient ${data.user.name}!`, 'success');
        } else {
            throw new Error('Verification failed.');
        }
    })
    .catch(err => {
        window.showGatewayError(err.message);
        showToast(err.message, 'error');
    });
}

window.handleStaffGatewayLogin = function(e) {
    if (e) e.preventDefault();
    window.showGatewayError(null);
    const inputStaffId = document.getElementById('gate-staff-id').value.trim();
    const inputQrToken = document.getElementById('gate-staff-qr').value.trim();

    if (!inputStaffId || !inputQrToken) {
        window.showGatewayError('Please insert Staff ID and Daily QR Token.');
        return;
    }

    showToast('Locating GPS coordinates...', 'info');

    navigator.geolocation.getCurrentPosition(
        position => {
            deviceLat = position.coords.latitude;
            deviceLon = position.coords.longitude;
            executeUnifiedLogin(inputStaffId, inputQrToken);
        },
        error => {
            console.warn('GPS location request denied. Falling back to default center coordinate markers.', error);
            deviceLat = 28.5983;
            deviceLon = 77.4332;
            executeUnifiedLogin(inputStaffId, inputQrToken);
        },
        { enableHighAccuracy: true, timeout: 5000 }
    );
}

function executeUnifiedLogin(inputStaffId, inputQrToken) {
    fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            staff_id: inputStaffId,
            password: inputQrToken,
            device_lat: deviceLat,
            device_lon: deviceLon
        })
    })
    .then(res => {
        if (!res.ok) throw new Error('Verification failed. Invalid credentials.');
        return res.json();
    })
    .then(data => {
        if (data.success && data.user) {
            localStorage.setItem('currentUser', JSON.stringify(data.user));
            localStorage.setItem('activeRole', data.user.role);
            
            staffId = data.user.id || inputStaffId;
            qrToken = inputQrToken;
            activeRole = data.user.role;
            facilityId = data.user.facility_id || '';
            staffName = data.user.name;

            localStorage.setItem('staffId', staffId);
            localStorage.setItem('qrToken', qrToken);
            localStorage.setItem('facilityId', facilityId);
            localStorage.setItem('staffName', staffName);
            if (deviceLat) localStorage.setItem('deviceLat', deviceLat);
            if (deviceLon) localStorage.setItem('deviceLon', deviceLon);

            const overlay = document.getElementById('gateway-overlay');
            if (overlay) overlay.style.setProperty('display', 'none', 'important');
            document.getElementById('portal-patient').style.display = 'none';
            document.getElementById('portal-admin').style.display = 'none';
            document.getElementById('portal-staff').style.display = 'block';

            document.getElementById('auth-container').style.display = 'none';
            document.getElementById('staff-workspace-container').style.display = 'flex';

            updateRoleState();
            switchTab(activeRole.toLowerCase() === 'staff' ? 'staff-dashboard' : activeRole.toLowerCase());
            showToast(`Clocked-In successfully. Welcome, ${staffName}!`, 'success');
        } else {
            throw new Error('Access Denied.');
        }
    })
    .catch(err => {
        window.showGatewayError(err.message);
        showToast(err.message, 'error');
    });
}

window.handleAdminGatewayLogin = function(e) {
    if (e) e.preventDefault();
    window.showGatewayError(null);
    const username = document.getElementById('gate-admin-username').value.trim();
    const password = document.getElementById('gate-admin-password').value.trim();

    fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username, password: password })
    })
    .then(res => {
        if (!res.ok) throw new Error('Access Denied. Invalid admin credentials.');
        return res.json();
    })
    .then(data => {
        if (data.success && data.user) {
            localStorage.setItem('currentUser', JSON.stringify(data.user));
            localStorage.setItem('activeRole', data.user.role);
            activeRole = data.user.role;

            const overlay = document.getElementById('gateway-overlay');
            if (overlay) overlay.style.setProperty('display', 'none', 'important');
            document.getElementById('portal-patient').style.display = 'none';
            document.getElementById('portal-admin').style.display = 'block';
            document.getElementById('portal-staff').style.display = 'none';

            fetchAdminData();
            showToast('Admin operations terminal unlocked.', 'success');
        } else {
            throw new Error('Access Denied.');
        }
    })
    .catch(err => {
        window.showGatewayError(err.message);
        showToast(err.message, 'error');
    });
}

// ==============================================
// 1. GLOBAL MASTER VIEW SWITCHER
// ==============================================
window.switchMasterView = function(targetRole) {
    const pPatient = document.getElementById('portal-patient');
    const pAdmin = document.getElementById('portal-admin');
    const pStaff = document.getElementById('portal-staff');
    
    pPatient.style.display = 'none';
    pAdmin.style.display = 'none';
    pStaff.style.display = 'none';
    
    if (targetRole === 'Patient') {
        activeRole = 'Patient';
        pPatient.style.display = 'block';
        fetchPatientFacilities();
    } else if (targetRole === 'Admin') {
        activeRole = 'Admin';
        pAdmin.style.display = 'block';
        fetchAdminData();
    } else if (targetRole === 'Staff') {
        pStaff.style.display = 'block';
        checkSession();
    }
}

// ==============================================
// 2. PATIENT PORTAL LOGIC
// ==============================================
async function fetchPatientFacilities() {
    try {
        const facilities = await apiFetch('/api/facilities');
        patientFacilitiesCache = facilities;
        renderPatientFacilities(facilities);
    } catch (err) {
        showToast(`Failed to load facility registry: ${err.message}`, 'error');
    }
}

function renderPatientFacilities(facilities) {
    const container = document.getElementById('patient-facilities-container');
    if (!container) return;
    container.innerHTML = '';
    
    const dict = patientTranslations[currentPatientLang] || patientTranslations['en'] || {};
    
    if (facilities.length === 0) {
        container.innerHTML = `
            <div class="empty-state-cell" style="grid-column: 1 / -1; text-align: center;">
                <div class="empty-state-content">
                    <i data-lucide="building"></i>
                    <p>${dict.empty_state_text || "No medical centers registered."}</p>
                </div>
            </div>`;
        lucide.createIcons();
        return;
    }

    facilities.forEach(fac => {
        const card = document.createElement('div');
        card.className = 'facility-card';
        
        card.addEventListener('click', (e) => {
            if (e.target.closest('.map-jump-btn') || e.target.closest('.facility-reviews-section') || e.target.closest('input') || e.target.closest('textarea') || e.target.closest('button') || e.target.closest('select')) {
                return;
            }
            card.classList.toggle('expanded');
        });

        const occupied = fac.beds_capacity - fac.available_beds;
        const percent = fac.beds_capacity > 0 ? Math.round((occupied / fac.beds_capacity) * 100) : 0;
        
        const address = fac.address || "Gautam Buddha Nagar";
        const mapUrl = fac.google_maps_url || "https://maps.google.com";
        
        const doctorsList = fac.doctors || fac.active_doctors || [];
        const testsList = fac.tests || fac.available_tests || fac.tests_available || [];
        
        let docsHtml = doctorsList.map(d => `<span class="test-tag" style="border-color:var(--accent-pink); color:var(--accent-pink); font-weight: 700;">${d}</span>`).join('');
        if (!docsHtml) docsHtml = `<span class="test-tag" style="opacity:0.5;">${dict.test_doctors_fallback || "No active physicians"}</span>`;

        let testsHtml = testsList.map(t => `<span class="test-tag">${t}</span>`).join('');
        if (!testsHtml) testsHtml = `<span class="test-tag" style="opacity:0.5;">${dict.test_tests_fallback || "No tests available"}</span>`;

        // Render reviews dynamically with strict null-pointer safety fallbacks
        const reviews = fac.reviews || [];
        let reviewsHtml = '';
        if (reviews.length === 0) {
            reviewsHtml = `<div class="no-reviews-placeholder" style="font-size: 0.8rem; color: var(--text-muted); font-style: italic;">${dict.no_reviews_text || "No reviews yet."}</div>`;
        } else {
            reviewsHtml = reviews.map(rev => {
                const ratingStars = '★'.repeat(rev.rating || 5) + '☆'.repeat(5 - (rev.rating || 5));
                return `
                    <div class="review-comment-card" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); border-radius: 8px; padding: 8px 12px; font-size: 0.8rem; display: flex; flex-direction: column; gap: 4px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-weight: 700; color: white;">${rev.patient_name || 'Anonymous'}</span>
                            <span style="color: var(--accent-amber); font-weight: bold; font-family: monospace;">${ratingStars}</span>
                        </div>
                        <p style="color: var(--text-secondary); margin: 2px 0;">"${rev.comment || ''}"</p>
                        <span style="font-size: 0.7rem; color: var(--text-muted); align-self: flex-end;">${rev.timestamp || ''}</span>
                    </div>
                `;
            }).join('');
        }

        card.innerHTML = `
            <!-- Top-Level Header View (Immediately Visible) -->
            <div class="facility-card-header-view">
                <div class="facility-card-info">
                    <span class="badge-tag facility-type-tag type-${(fac.type || 'PHC').toLowerCase()}">${fac.type || 'PHC'}</span>
                    <h3 style="margin-top: 6px;">${fac.name || 'Health Center'}</h3>
                    <div class="facility-address">${address}</div>
                </div>
                <div class="facility-actions">
                    <a href="${mapUrl}" target="_blank" class="map-jump-btn" title="Open Google Maps">
                        <i data-lucide="map-pin"></i>
                    </a>
                    <div class="expand-chevron">
                        <i data-lucide="chevron-down"></i>
                    </div>
                </div>
            </div>

            <!-- Dropdown Menu View (Revealed via Smooth Slide Expansion Click) -->
            <div class="facility-card-dropdown">
                <div class="facility-capacity-container">
                    <div class="capacity-labels">
                        <span>${dict.beds_utilized || "Beds Occupied"}</span>
                        <span>${occupied || 0} / ${fac.beds_capacity || 0} (${percent}%)</span>
                    </div>
                    <div class="capacity-meter-bg">
                        <div class="capacity-meter-fill ${percent >= 80 ? 'warning' : ''}" style="width: ${percent}%"></div>
                    </div>
                </div>

                <div class="dropdown-section">
                    <h5>${dict.available_physicians || "Available Doctors"}</h5>
                    <div class="tests-tag-container">${docsHtml}</div>
                </div>

                <div class="dropdown-section">
                    <h5>${dict.available_diagnostics || "Available Tests"}</h5>
                    <div class="tests-tag-container">${testsHtml}</div>
                </div>

                <!-- Patient Reviews Section -->
                <div class="facility-reviews-section" style="margin-top: 15px; border-top: 1px dashed var(--border-glass); padding-top: 15px; text-align: left;">
                    <h5 style="margin-bottom: 10px; font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase;">${dict.review_title || "Reviews"}</h5>
                    
                    <div class="reviews-list facility-reviews-feed" data-facility-id="${fac.id}" id="reviews-feed-${fac.id}" style="max-height: 180px; overflow-y: auto; margin-bottom: 12px; display: flex; flex-direction: column; gap: 8px; padding-right: 4px;">
                        ${reviewsHtml}
                    </div>

                    <form class="review-form facility-review-form" data-facility-id="${fac.id}" style="display: flex; flex-direction: column; gap: 8px; background: rgba(0,0,0,0.15); padding: 12px; border-radius: 12px; border: 1px solid var(--border-glass);">
                        <span style="font-size: 0.78rem; font-weight: 700; color: white;">${dict.leave_review_title}</span>
                        
                        <div style="display: flex; gap: 10px; align-items: center;">
                            <input type="text" id="review-name-${fac.id}" placeholder="Your Name" value="${localStorage.getItem('patientName') || ''}" required style="flex: 1; padding: 6px 10px; border-radius: 6px; background: rgba(0,0,0,0.2); border: 1px solid var(--border-glass); color: white; font-size: 0.8rem;">
                            
                            <select id="review-rating-${fac.id}" required style="padding: 6px 10px; border-radius: 6px; background: rgba(0,0,0,0.2); border: 1px solid var(--border-glass); color: white; font-size: 0.8rem; width: 100px; outline: none; cursor: pointer;">
                                <option value="5">5 ★</option>
                                <option value="4">4 ★</option>
                                <option value="3">3 ★</option>
                                <option value="2">2 ★</option>
                                <option value="1">1 ★</option>
                            </select>
                        </div>
                        
                        <textarea id="review-comment-${fac.id}" placeholder="${dict.comment_placeholder}" required rows="2" style="padding: 8px 10px; border-radius: 6px; background: rgba(0,0,0,0.2); border: 1px solid var(--border-glass); color: white; font-size: 0.8rem; resize: none;"></textarea>
                        
                        <button type="submit" class="primary-btn" style="width: 100%; padding: 6px 12px; font-size: 0.8rem; justify-content: center; height: 32px; font-weight: 700; border-radius: 6px;">
                            ${dict.submit_review_btn}
                        </button>
                    </form>
                </div>
            </div>
        `;
        
        // Dynamically bind the form's submit listener
        const form = card.querySelector('.review-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                window.submitFacilityReview(e, fac.id);
            });
        }

        container.appendChild(card);
    });
    lucide.createIcons();
}

window.submitFacilityReview = async function(e, facilityId) {
    e.preventDefault();
    
    const nameInput = document.getElementById(`review-name-${facilityId}`);
    const ratingSelect = document.getElementById(`review-rating-${facilityId}`);
    const commentTextarea = document.getElementById(`review-comment-${facilityId}`);
    
    const name = nameInput.value.trim();
    const rating = parseInt(ratingSelect.value);
    const comment = commentTextarea.value.trim();
    
    if (!name || !rating || !comment) {
        showToast('Please fill out all fields to submit your review.', 'error');
        return;
    }
    
    try {
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
        const newReview = await apiFetch('/api/facilities/review', {
            method: 'POST',
            body: JSON.stringify({
                facility_id: facilityId,
                patient_name: name,
                rating: rating,
                comment: comment,
                timestamp: timestamp
            })
        });
        
        showToast('Review submitted successfully!', 'success');
        
        const fac = patientFacilitiesCache.find(f => f.id === facilityId);
        if (fac) {
            if (!fac.reviews) fac.reviews = [];
            fac.reviews.push(newReview);
        }
        
        renderPatientFacilities(patientFacilitiesCache);
        
        // Keep the updated card expanded
        const cards = document.querySelectorAll('.facility-card');
        cards.forEach(card => {
            const feed = card.querySelector(`#reviews-feed-${facilityId}`);
            if (feed) {
                card.classList.add('expanded');
            }
        });
        
    } catch (err) {
        showToast(`Failed to submit review: ${err.message}`, 'error');
    }
}

window.filterPatientFacilities = function() {
    const searchVal = document.getElementById('patient-test-search').value.trim().toLowerCase();
    
    if (!searchVal) {
        renderPatientFacilities(patientFacilitiesCache);
        return;
    }
    
    const filtered = patientFacilitiesCache.filter(fac => {
        const testsList = fac.tests || fac.available_tests || fac.tests_available || [];
        return testsList.some(test => test.toLowerCase().includes(searchVal));
    });
    
    renderPatientFacilities(filtered);
}


// ==============================================
// 3. DISTRICT ADMIN COMMAND CENTER LOGIC
// ==============================================
let activeAdminDir = 'facs';

async function fetchAdminData() {
    await fetchAdminDashboardStats();
    await fetchAdminQRList();
    await fetchLiveBreaches();
    await loadAdminDirectory(activeAdminDir);
    await fetchAdminAnalytics();
    const select = document.getElementById('admin-feature-select');
    if (select) {
        window.switchAdminFeature(select.value);
    }
}

window.fetchAdminAnalytics = async function() {
    try {
        const stats = await apiFetch('/api/admin/analytics');
        
        // Component A: Live Metric Counter Cards
        document.getElementById('ai-active-staff').innerText = stats.district_stats.total_active_staff;
        document.getElementById('ai-cumulative-footfall').innerText = stats.district_stats.cumulative_footfall;
        document.getElementById('ai-free-beds').innerText = stats.district_stats.total_free_beds;
        document.getElementById('ai-critical-alerts').innerText = stats.district_stats.active_critical_alerts;

        // Render Summary Leaderboard
        const topContainer = document.getElementById('admin-top-leaderboard');
        if (topContainer) {
            topContainer.innerHTML = '';
            stats.facilities_analytics.slice(0, 3).forEach((fac, idx) => {
                const li = document.createElement('li');
                li.style.marginBottom = '6px';
                li.innerHTML = `<strong style="color:white;">#${idx+1} ${fac.facility_name}</strong> - Score: <span style="color:var(--accent-teal); font-weight:bold;">${fac.performance_score}</span>`;
                topContainer.appendChild(li);
            });
        }

        const criticalContainer = document.getElementById('admin-critical-leaderboard');
        if (criticalContainer) {
            criticalContainer.innerHTML = '';
            const criticals = stats.facilities_analytics.filter(f => f.performance_tier === 'UNDERPERFORMING_CRITICAL');
            if (criticals.length === 0) {
                criticalContainer.innerHTML = `<li style="list-style-type:none; color:var(--text-muted);">No centers in critical deficit.</li>`;
            } else {
                criticals.forEach(fac => {
                    const li = document.createElement('li');
                    li.style.marginBottom = '6px';
                    li.innerHTML = `<strong style="color:#f87171;">${fac.facility_name}</strong> - Score: <span style="font-weight:bold; color:#f87171;">${fac.performance_score}</span> (Beds Occupied: ${fac.occupied_beds}/${fac.beds_capacity})`;
                    criticalContainer.appendChild(li);
                });
            }
        }
        
        // Component B: Live District Map Feed Table
        const tbody = document.getElementById('ai-map-feed-tbody');
        tbody.innerHTML = '';
        
        stats.facilities_analytics.forEach(fac => {
            let badgeClass = '';
            let badgeLabel = '';
            if (fac.performance_tier === 'OPTIMAL_PERFORMANCE') {
                badgeClass = 'status-optimal-ai';
                badgeLabel = 'Optimal Performance';
            } else if (fac.performance_tier === 'STRAINED_CAPACITY') {
                badgeClass = 'status-strained-ai';
                badgeLabel = 'Strained Capacity';
            } else {
                badgeClass = 'status-critical-ai';
                badgeLabel = 'Critical Deficit';
            }
            
            const tr = document.createElement('tr');
            const token = fac.daily_qr_token;
            const tokenDisplay = token && token !== 'Not Generated'
                ? `<span class="token-value" style="font-size:0.8rem; padding: 4px 8px;">${token}</span>` 
                : `<span class="token-value empty" style="font-size:0.8rem; padding: 4px 8px;">Not Generated</span>`;
                
            tr.innerHTML = `
                <td style="font-weight:700; color:white">${fac.facility_name}</td>
                <td>${tokenDisplay}</td>
                <td style="font-weight:600;">${fac.present_staff} / ${fac.total_staff}</td>
                <td><span class="badge-tag ${badgeClass}">${badgeLabel}</span></td>
            `;
            tbody.appendChild(tr);
        });
        
        // Component C: AI Copilot System Recommendations
        const container = document.getElementById('ai-recommendations-container');
        container.innerHTML = '';
        
        stats.recommendations.forEach(rec => {
            const item = document.createElement('div');
            item.style.backgroundColor = 'rgba(255,255,255,0.015)';
            item.style.borderLeft = '3px solid var(--accent-purple)';
            item.style.padding = '12px 16px';
            item.style.borderRadius = '0 10px 10px 0';
            item.style.display = 'flex';
            item.style.gap = '10px';
            item.style.alignItems = 'flex-start';
            item.style.boxShadow = 'inset 0 0 10px rgba(255,255,255,0.01)';
            
            let icon = 'sparkles';
            let color = 'var(--accent-purple)';
            if (rec.startsWith('Staff')) {
                icon = 'shuffle';
                color = 'var(--accent-blue)';
                item.style.borderLeftColor = 'var(--accent-blue)';
            } else if (rec.startsWith('Patient')) {
                icon = 'navigation';
                color = 'var(--accent-emerald)';
                item.style.borderLeftColor = 'var(--accent-emerald)';
            } else if (rec.startsWith('Resource')) {
                icon = 'truck';
                color = 'var(--accent-amber)';
                item.style.borderLeftColor = 'var(--accent-amber)';
            }
            
            item.innerHTML = `
                <i data-lucide="${icon}" style="width: 18px; height: 18px; color: ${color}; flex-shrink: 0; margin-top: 2px;"></i>
                <span style="color: var(--text-secondary); font-size: 0.88rem; font-weight: 500;">${rec}</span>
            `;
            container.appendChild(item);
        });
        
        lucide.createIcons();
    } catch (err) {
        console.error('Failed to load AI optimization telemetry:', err);
    }
}


async function fetchAdminDashboardStats() {
    try {
        const stats = await apiFetch('/api/dashboard-stats');
        document.getElementById('admin-stat-facilities').innerText = stats.facilities_count;
        document.getElementById('admin-stat-beds').innerText = `${stats.occupied_beds} / ${stats.total_beds}`;
        document.getElementById('admin-stat-staff').innerText = stats.staff_count;
        document.getElementById('admin-stat-inventory').innerText = stats.low_stock_count;
    } catch (err) {
        console.error(err);
    }
}

async function fetchAdminQRList() {
    try {
        const facilities = await apiFetch('/api/facilities');
        const container = document.getElementById('admin-qr-list-container');
        container.innerHTML = '';
        
        facilities.forEach(fac => {
            const row = document.createElement('div');
            row.className = 'facility-qr-row';
            
            const token = fac.daily_qr_token;
            const tokenDisplay = token 
                ? `<span class="token-value">${token}</span>` 
                : `<span class="token-value empty">Not Generated</span>`;
                
            row.innerHTML = `
                <div class="fac-info">
                    <h4>${fac.name}</h4>
                    <p>ID: ${fac.id}</p>
                </div>
                <div class="token-box">${tokenDisplay}</div>
            `;
            container.appendChild(row);
        });
    } catch (err) {
        console.error(err);
    }
}

async function triggerForceQRGeneration() {
    try {
        const res = await apiFetch('/api/admin/generate-qr-tokens', {
            method: 'POST',
            body: JSON.stringify({})
        });
        showToast(res.message || 'Daily security QR keys generated!', 'success');
        await fetchAdminQRList();
        await loadAdminDirectory(activeAdminDir);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function fetchLiveBreaches() {
    try {
        const violations = await apiFetch('/api/admin/breach-monitor');
        const container = document.getElementById('admin-breach-feed-container');
        container.innerHTML = '';
        
        if (violations.length === 0) {
            container.innerHTML = `
                <div style="padding: 30px; text-align: center; color: var(--text-muted)">
                    <i data-lucide="shield-check" style="width: 32px; height: 32px; margin-bottom: 8px; color: var(--accent-emerald);"></i>
                    <p>No active geofence violations detected.</p>
                </div>`;
            lucide.createIcons();
            return;
        }

        violations.forEach(v => {
            const div = document.createElement('div');
            div.className = 'breach-item';
            div.innerHTML = `
                <div class="breach-item-header">
                    <span class="breach-staff-name">${v.staff_name} (ID: ${v.staff_id})</span>
                    <span class="breach-status-badge">
                        <span class="flashing-dot"></span> Geofence breach
                    </span>
                </div>
                <div class="breach-details">
                    <div class="breach-detail-cell">
                        <i data-lucide="building"></i>
                        <span>Center: ${v.facility_name}</span>
                    </div>
                    <div class="breach-detail-cell">
                        <i data-lucide="navigation"></i>
                        <span>Distance: <strong class="distance-value">${v.distance_meters}m</strong></span>
                    </div>
                    <div class="breach-detail-cell">
                        <i data-lucide="clock"></i>
                        <span>Time clocked: ${v.check_in}</span>
                    </div>
                    <div class="breach-detail-cell">
                        <i data-lucide="map-pin"></i>
                        <span>Device: ${v.device_coords[0]}, ${v.device_coords[1]}</span>
                    </div>
                </div>
            `;
            container.appendChild(div);
        });
        lucide.createIcons();
    } catch (err) {
        console.error(err);
    }
}

// Toggle Admin directories
window.toggleAdminDir = function(dirName) {
    activeAdminDir = dirName;
    
    // Toggle active class on buttons
    const buttons = document.querySelectorAll('.directory-tabs-header button');
    buttons.forEach(btn => {
        if (btn.id === `dir-btn-${dirName}`) {
            btn.classList.add('active-dir-btn');
        } else {
            btn.classList.remove('active-dir-btn');
        }
    });

    // Toggle active container view
    const containers = document.querySelectorAll('.admin-directory-view');
    containers.forEach(box => {
        if (box.id === `dir-container-${dirName}`) {
            box.style.display = 'block';
        } else {
            box.style.display = 'none';
        }
    });

    loadAdminDirectory(dirName);
}

async function loadAdminDirectory(dirName) {
    try {
        if (dirName === 'facs') {
            const facilities = await apiFetch('/api/facilities');
            const tbody = document.getElementById('admin-facs-table-body');
            tbody.innerHTML = '';
            
            facilities.forEach(f => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="font-weight:700; color:var(--accent-blue)">${f.id}</td>
                    <td style="font-weight:600; color:white">${f.name}</td>
                    <td><span class="badge-tag info-tag">${f.type}</span></td>
                    <td>${f.beds_capacity} beds</td>
                    <td>${f.lat}</td>
                    <td>${f.lon}</td>
                    <td>${f.available_tests.join(', ') || '-'}</td>
                `;
                tbody.appendChild(tr);
            });
        } 
        else if (dirName === 'users') {
            const users = await apiFetch('/api/users');
            const tbody = document.getElementById('admin-users-table-body');
            tbody.innerHTML = '';
            
            users.forEach(u => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="font-weight:700; color:var(--accent-blue)">${u.id}</td>
                    <td style="font-weight:600; color:white">${u.name}</td>
                    <td><span class="badge-tag info-tag">${u.role}</span></td>
                    <td>${u.contact || '-'}</td>
                    <td>${u.email || '-'}</td>
                `;
                tbody.appendChild(tr);
            });
        } 
        else if (dirName === 'staff') {
            const staff = await apiFetch('/api/staff');
            const facilities = await apiFetch('/api/facilities').catch(() => []);
            const facMap = {};
            facilities.forEach(f => facMap[f.id] = f.name);

            const tbody = document.getElementById('admin-staff-table-body');
            tbody.innerHTML = '';
            
            staff.forEach(s => {
                const tr = document.createElement('tr');
                const badgeClass = s.status === 'Active' ? 'status-active' : 'status-leave';
                tr.innerHTML = `
                    <td style="font-weight:700; color:var(--accent-blue)">${s.id}</td>
                    <td style="font-weight:600; color:white">${s.name}</td>
                    <td>${s.role}</td>
                    <td>${facMap[s.facility_id] || s.facility_id}</td>
                    <td>${s.contact || '-'}</td>
                    <td><span class="badge-tag ${badgeClass}">${s.status}</span></td>
                `;
                tbody.appendChild(tr);
            });
        } 
        else if (dirName === 'attendance') {
            const logs = await apiFetch('/api/attendance');
            const staffList = await apiFetch('/api/staff').catch(() => []);
            const sMap = {};
            staffList.forEach(s => sMap[s.id] = s.name);

            const tbody = document.getElementById('admin-attendance-table-body');
            tbody.innerHTML = '';
            
            logs.forEach(log => {
                const tr = document.createElement('tr');
                let badgeClass = 'status-absent';
                if (log.status === 'Present') badgeClass = 'status-present';
                else if (log.status === 'On Leave') badgeClass = 'status-leave';
                else if (log.status === 'GEOFENCE_VIOLATION') badgeClass = 'status-alert';
                
                const actionHtml = (log.status === 'Present' || log.status === 'GEOFENCE_VIOLATION') && !log.check_out
                    ? `<button class="badge-btn badge-btn-danger" onclick="adminCheckoutStaff('${log.staff_id}')">Clock Out</button>`
                    : `-`;
                    
                tr.innerHTML = `
                    <td style="font-weight:700; color:var(--accent-blue)">${log.id}</td>
                    <td style="font-weight:600; color:white">${sMap[log.staff_id] || log.staff_id}</td>
                    <td>${log.date}</td>
                    <td><span class="badge-tag ${badgeClass}">${log.status}</span></td>
                    <td>${log.check_in || '-'}</td>
                    <td>${log.check_out || '-'}</td>
                    <td>${log.device_lat !== null ? `${log.device_lat}, ${log.device_lon}` : '-'}</td>
                    <td>${actionHtml}</td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (err) {
        console.error(err);
    }
}

async function adminCheckoutStaff(staffIdVal) {
    try {
        await apiFetch('/api/attendance/checkout', {
            method: 'POST',
            body: JSON.stringify({ staff_id: staffIdVal })
        });
        showToast('Staff clock-out recorded.', 'success');
        loadAdminDirectory('attendance');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ==============================================
// 4. SECURE STAFF TERMINAL WORKSPACE
// ==============================================

// Session manager
function checkSession() {
    const currentUserStr = localStorage.getItem('currentUser');
    const savedActiveRole = localStorage.getItem('activeRole') || (currentUserStr ? JSON.parse(currentUserStr).role : null);

    if (!savedActiveRole) {
        // No active session: show gateway overlay and hide all master portal wrappers
        document.getElementById('gateway-overlay').style.display = 'flex';
        document.getElementById('portal-patient').style.display = 'none';
        document.getElementById('portal-admin').style.display = 'none';
        document.getElementById('portal-staff').style.display = 'none';
        return;
    }

    // Hide gateway overlay since we have an active session
    document.getElementById('gateway-overlay').style.display = 'none';

    const pPatient = document.getElementById('portal-patient');
    const pAdmin = document.getElementById('portal-admin');
    const pStaff = document.getElementById('portal-staff');
    
    pPatient.style.display = 'none';
    pAdmin.style.display = 'none';
    pStaff.style.display = 'none';

    if (savedActiveRole === 'Patient') {
        activeRole = 'Patient';
        pPatient.style.display = 'block';
        fetchPatientFacilities();
    } else if (savedActiveRole === 'Admin') {
        activeRole = 'Admin';
        pAdmin.style.display = 'block';
        fetchAdminData();
    } else {
        // Staff roles
        const user = currentUserStr ? JSON.parse(currentUserStr) : {};
        staffId = localStorage.getItem('staffId') || user.id || '';
        qrToken = localStorage.getItem('qrToken') || '';
        activeRole = savedActiveRole;
        facilityId = localStorage.getItem('facilityId') || user.facility_id || '';
        facilityName = localStorage.getItem('facilityName') || '';
        staffName = localStorage.getItem('staffName') || user.name || '';
        
        const savedLat = localStorage.getItem('deviceLat');
        const savedLon = localStorage.getItem('deviceLon');
        deviceLat = savedLat ? parseFloat(savedLat) : null;
        deviceLon = savedLon ? parseFloat(savedLon) : null;

        pStaff.style.display = 'block';
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('staff-workspace-container').style.display = 'flex';

        updateRoleState();
        switchTab(activeRole.toLowerCase() === 'staff' ? 'staff-dashboard' : activeRole.toLowerCase());
    }
}

window.logoutGateway = function(e) {
    if (e) e.preventDefault();
    localStorage.clear();
    staffId = '';
    qrToken = '';
    activeRole = 'Patient'; // Default back
    facilityId = '';
    facilityName = '';
    staffName = '';
    deviceLat = null;
    deviceLon = null;
    
    // Clear bypass fields
    const bypassInput = document.getElementById('gate-backdoor-bypass');
    if (bypassInput) bypassInput.value = '';
    
    // Show gateway overlay and hide portals
    document.getElementById('gateway-overlay').style.display = 'flex';
    document.getElementById('portal-patient').style.display = 'none';
    document.getElementById('portal-admin').style.display = 'none';
    document.getElementById('portal-staff').style.display = 'none';
    
    window.showGatewayError(null);
    showToast('Logged out successfully.', 'info');
}

window.logoutStaff = window.logoutGateway;

// Login verification
window.handleStaffLogin = async function(e) {
    e.preventDefault();
    const inputStaffId = document.getElementById('auth-staff-id').value.trim();
    const inputQrToken = document.getElementById('auth-qr-token').value.trim();

    if (!inputStaffId || !inputQrToken) {
        showToast('Please insert Staff ID and Daily QR Token.', 'error');
        return;
    }

    showToast('Locating GPS coordinates...', 'info');

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            deviceLat = position.coords.latitude;
            deviceLon = position.coords.longitude;
            await executeVerification(inputStaffId, inputQrToken);
        },
        async (error) => {
            console.warn('GPS location request denied. Falling back to default center coordinate markers.', error);
            // Gautum Buddha Nagar coordinations fallback
            deviceLat = 28.5983;
            deviceLon = 77.4332;
            showToast('Using facility backup localization markers.', 'warning');
            await executeVerification(inputStaffId, inputQrToken);
        },
        { enableHighAccuracy: true, timeout: 5000 }
    );
}

async function executeVerification(inputStaffId, inputQrToken) {
    try {
        const response = await fetch('/api/staff/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                staff_id: inputStaffId,
                qr_token: inputQrToken,
                device_lat: deviceLat,
                device_lon: deviceLon
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.description || 'Verification failed. Access Denied.');
        }

        const data = await response.json();
        
        // Save status
        staffId = data.staff_id;
        qrToken = inputQrToken;
        activeRole = data.active_role;
        facilityId = data.facility_id;
        facilityName = data.facility_name;
        staffName = data.name;

        // Save session cache
        localStorage.setItem('staffId', staffId);
        localStorage.setItem('qrToken', qrToken);
        localStorage.setItem('activeRole', activeRole);
        localStorage.setItem('facilityId', facilityId);
        localStorage.setItem('facilityName', facilityName);
        localStorage.setItem('staffName', staffName);
        if (deviceLat) localStorage.setItem('deviceLat', deviceLat);
        if (deviceLon) localStorage.setItem('deviceLon', deviceLon);

        showToast(`Clocked-In successfully. Welcome, ${staffName}!`, 'success');

        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('staff-workspace-container').style.display = 'flex';

        const roleSelect = document.getElementById('role-select');
        if (roleSelect) roleSelect.value = activeRole;

        updateRoleState();
        
        const defaultTab = activeRole.toLowerCase() === 'staff' ? 'staff-dashboard' : activeRole.toLowerCase();
        switchTab(defaultTab);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Workspace tab switcher
window.switchTab = function(tabName) {
    currentTab = tabName;
    
    // Toggle menu items active style
    const menuItems = document.querySelectorAll('.sidebar-menu .menu-item');
    menuItems.forEach(item => {
        if (item.getAttribute('data-tab-target') === tabName) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Toggle tab panels display
    const tabViews = document.querySelectorAll('.tab-view');
    tabViews.forEach(view => {
        if (view.id === `view-${tabName}`) {
            view.classList.add('active');
        } else {
            view.classList.remove('active');
        }
    });

    const pageTitle = document.getElementById('page-title');
    const pageSubtitle = document.getElementById('page-subtitle');
    
    switch (tabName) {
        case 'reception':
            pageTitle.innerText = 'Reception Admission Desk';
            pageSubtitle.innerText = `Filing admissions & bed capacity tracking for ${facilityName || 'your center'}.`;
            break;
        case 'doctor':
            pageTitle.innerText = 'Doctor Diagnostic Queue';
            pageSubtitle.innerText = `Assess patients, assign beds, and coordinate release processes.`;
            break;
        case 'pharmacist':
            pageTitle.innerText = 'Pharmacist Dispensing Desk';
            pageSubtitle.innerText = `Manage medicine stock supplies and dispense medications rapidly.`;
            break;
        case 'nurse':
            pageTitle.innerText = 'Nurse Utility Desk';
            pageSubtitle.innerText = `Quick-glance active doctors directory and interactive bed mapping.`;
            break;
        case 'staff-dashboard':
            pageTitle.innerText = 'District Metrics Board';
            pageSubtitle.innerText = 'Consolidated review of bed capacity and medication statuses.';
            break;
        case 'staff-facilities':
            pageTitle.innerText = 'District Facility Directory';
            pageSubtitle.innerText = 'Active capabilities, GPS markers, and staff distribution profiles.';
            break;
        case 'staff-admissions':
            pageTitle.innerText = 'Bed Admission Stats';
            pageSubtitle.innerText = 'Detailed audit log of patient admissions and release history.';
            break;
    }

    refreshCurrentTabData();
}

function updateRoleState() {
    document.getElementById('display-role').innerText = `${activeRole} View`;
    
    const dot = document.querySelector('.user-role-badge .dot');
    if (activeRole === 'Admin') {
        dot.style.backgroundColor = 'var(--accent-purple)';
        dot.style.boxShadow = '0 0 8px var(--accent-purple)';
    } else if (activeRole === 'Doctor') {
        dot.style.backgroundColor = 'var(--accent-pink)';
        dot.style.boxShadow = '0 0 8px var(--accent-pink)';
    } else if (activeRole === 'Nurse') {
        dot.style.backgroundColor = 'var(--accent-teal)';
        dot.style.boxShadow = '0 0 8px var(--accent-teal)';
    } else if (activeRole === 'Pharmacist') {
        dot.style.backgroundColor = 'var(--accent-amber)';
        dot.style.boxShadow = '0 0 8px var(--accent-amber)';
    } else if (activeRole === 'Reception') {
        dot.style.backgroundColor = 'var(--accent-blue)';
        dot.style.boxShadow = '0 0 8px var(--accent-blue)';
    }

    // Toggle menu items visibility by role permissions
    const isReception = activeRole === 'Reception' || activeRole === 'Admin';
    const isDoctor = activeRole === 'Doctor' || activeRole === 'Admin';
    const isPharmacist = activeRole === 'Pharmacist' || activeRole === 'Admin';
    const isNurse = activeRole === 'Nurse' || activeRole === 'Admin';

    document.getElementById('nav-reception').style.display = isReception ? 'flex' : 'none';
    document.getElementById('nav-doctor').style.display = isDoctor ? 'flex' : 'none';
    document.getElementById('nav-pharmacist').style.display = isPharmacist ? 'flex' : 'none';
    document.getElementById('nav-nurse').style.display = isNurse ? 'flex' : 'none';

    verifyTabAccess(currentTab);
    refreshCurrentTabData();
}

function verifyTabAccess(tabName) {
    const isReceptionTab = ['reception'].includes(tabName);
    const isDoctorTab = ['doctor'].includes(tabName);
    const isPharmacistTab = ['pharmacist'].includes(tabName);
    const isNurseTab = ['nurse'].includes(tabName);

    const isReception = activeRole === 'Reception' || activeRole === 'Admin';
    const isDoctor = activeRole === 'Doctor' || activeRole === 'Admin';
    const isPharmacist = activeRole === 'Pharmacist' || activeRole === 'Admin';
    const isNurse = activeRole === 'Nurse' || activeRole === 'Admin';

    let accessDenied = false;
    if (isReceptionTab && !isReception) accessDenied = true;
    if (isDoctorTab && !isDoctor) accessDenied = true;
    if (isPharmacistTab && !isPharmacist) accessDenied = true;
    if (isNurseTab && !isNurse) accessDenied = true;

    if (accessDenied) {
        if (isReception) switchTab('reception');
        else if (isDoctor) switchTab('doctor');
        else if (isPharmacist) switchTab('pharmacist');
        else if (isNurse) switchTab('nurse');
        else switchTab('staff-dashboard');
    }
}

// Refresh active tab lists
function refreshCurrentTabData() {
    switch (currentTab) {
        case 'reception':
            fetchReceptionData();
            break;
        case 'doctor':
            fetchDoctorQueue();
            break;
        case 'pharmacist':
            fetchPharmacistInventory();
            break;
        case 'nurse':
            fetchNurseDashboard();
            break;
        case 'staff-dashboard':
            fetchStaffDashboardStats();
            break;
        case 'staff-facilities':
            fetchStaffFacilitiesList();
            break;
        case 'staff-admissions':
            fetchStaffAdmissionsList();
            break;
    }
}

// R1. Reception view data
async function fetchReceptionData() {
    try {
        document.getElementById('reception-center-name').innerText = `${facilityName || 'District'} Reception Desk`;
        
        const facilities = await apiFetch('/api/facilities');
        const center = facilities.find(f => f.id === facilityId);

        if (center) {
            document.getElementById('reception-token-value').innerText = center.daily_qr_token || 'TOKEN NOT GENERATED';
            document.getElementById('reception-total-beds').innerText = center.beds_capacity;
            document.getElementById('reception-available-beds').innerText = center.available_beds;
            document.getElementById('reception-occupied-beds').innerText = center.beds_capacity - center.available_beds;
        }
    } catch (err) {
        showToast(`Failed to load reception: ${err.message}`, 'error');
    }
}

window.submitReceptionAdmission = async function(e) {
    e.preventDefault();
    
    const name = document.getElementById('adm-name').value.trim();
    const age = document.getElementById('adm-age').value.trim();
    const gender = document.getElementById('adm-gender').value;
    const complication = document.getElementById('adm-complication').value.trim();
    const phone = document.getElementById('adm-phone').value.trim();
    const attendee = document.getElementById('adm-attendee').value.trim();
    const attendeePhone = document.getElementById('adm-attendee-phone').value.trim();

    try {
        showToast('Registering user details...', 'info');
        
        const userResult = await apiFetch('/api/users', {
            method: 'POST',
            body: JSON.stringify({
                name: name,
                role: 'Patient',
                phone: phone,
                contact: phone,
                email: ''
            })
        });

        const userId = userResult.id;
        showToast('Admitting patient entry...', 'info');

        const reasonStr = `Primary Complication: ${complication} | Age: ${age} | Gender: ${gender} | Attendee: ${attendee || 'None'} (Phone: ${attendeePhone || 'N/A'})`;

        await apiFetch('/api/admissions', {
            method: 'POST',
            body: JSON.stringify({
                facility_id: facilityId,
                user_id: userId,
                reason: reasonStr,
                status: 'Admitted'
            })
        });

        showToast('Patient admitted successfully!', 'success');
        document.getElementById('reception-admission-form').reset();
        fetchReceptionData();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// R2. Doctor view data
async function fetchDoctorQueue() {
    try {
        const admissions = await apiFetch('/api/admissions');
        const container = document.getElementById('doctor-queue-container');
        container.innerHTML = '';

        const localAdmissions = admissions.filter(a => a.facility_id === facilityId && a.status !== 'Discharged' && a.status !== 'Released');

        if (localAdmissions.length === 0) {
            container.innerHTML = `
                <div class="empty-state-cell" style="grid-column: 1 / -1; width: 100%;">
                    <div class="empty-state-content">
                        <i data-lucide="stethoscope"></i>
                        <p>No active diagnostic queue patients present.</p>
                    </div>
                </div>`;
            lucide.createIcons();
            return;
        }

        const users = await apiFetch('/api/users').catch(() => []);
        const uLookup = {};
        users.forEach(u => uLookup[u.id] = u.name);

        localAdmissions.forEach(adm => {
            const card = document.createElement('div');
            card.className = 'patient-clinical-card';
            
            const isWaiting = adm.status === 'Admitted';
            const badgeClass = isWaiting ? 'patient-badge-waiting' : 'patient-badge-active';
            const statusLabel = isWaiting ? 'Awaiting bed allocation' : 'Active Patient (In-bed)';
            const patientName = uLookup[adm.user_id] || adm.user_id;

            card.innerHTML = `
                <div class="patient-card-top">
                    <div>
                        <span class="patient-card-name">${patientName}</span>
                        <div class="patient-card-age-gender">ID: ${adm.user_id}</div>
                    </div>
                    <span class="patient-card-badge ${badgeClass}">${statusLabel}</span>
                </div>
                <div class="patient-card-body">
                    <div class="patient-detail-row">
                        <i data-lucide="activity"></i>
                        <span><strong>Clinical Record:</strong> ${adm.reason}</span>
                    </div>
                    <div class="patient-detail-row">
                        <i data-lucide="calendar"></i>
                        <span><strong>Admitted On:</strong> ${adm.admission_date}</span>
                    </div>
                </div>
                <div class="patient-card-actions">
                    ${isWaiting ? `
                        <button class="primary-btn" onclick="assignDoctorBed('${adm.id}')">
                            <i data-lucide="check"></i> Assign Bed
                        </button>
                    ` : `
                        <button class="secondary-btn" style="border-color:var(--accent-crimson); color:var(--accent-crimson);" onclick="dischargeDoctorPatient('${adm.id}')">
                            <i data-lucide="log-out"></i> Discharge Patient
                        </button>
                    `}
                </div>
            `;
            container.appendChild(card);
        });
        lucide.createIcons();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

window.assignDoctorBed = async function(admissionId) {
    try {
        const facilities = await apiFetch('/api/facilities');
        const currentFacility = facilities.find(f => f.id === facilityId);

        if (currentFacility && currentFacility.available_beds <= 0) {
            showToast(`Capacity Alert: ${facilityName} has no vacant beds left.`, 'error');
            return;
        }

        await apiFetch('/api/admissions/discharge', {
            method: 'POST',
            body: JSON.stringify({ id: admissionId, status: 'Active' })
        });
        showToast('Bed allocated successfully.', 'success');
        fetchDoctorQueue();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

window.dischargeDoctorPatient = async function(admissionId) {
    try {
        await apiFetch('/api/admissions/discharge', {
            method: 'POST',
            body: JSON.stringify({ id: admissionId, status: 'Released' })
        });
        showToast('Treatment done. Patient released!', 'success');
        fetchDoctorQueue();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// R3. Pharmacist view data
async function fetchPharmacistInventory() {
    try {
        const inventory = await apiFetch('/api/inventory');
        const localInventory = inventory.filter(i => i.facility_id === facilityId);

        const tbody = document.getElementById('pharmacist-stock-table-body');
        tbody.innerHTML = '';

        const selectDispense = document.getElementById('dispense-medication-id');
        const prevDispenseVal = selectDispense.value;
        selectDispense.innerHTML = '<option value="">-- Select medicine --</option>';

        const selectIntake = document.getElementById('intake-medication-id');
        const prevIntakeVal = selectIntake ? selectIntake.value : '';
        if (selectIntake) {
            selectIntake.innerHTML = '<option value="">-- Select medicine --</option>';
        }

        if (localInventory.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="empty-state-cell" style="text-align:center;">No stock registered for this center.</td></tr>`;
            return;
        }

        localInventory.forEach(item => {
            const isLow = item.quantity < item.min_required;
            const statusText = isLow ? 'LOW STOCK' : 'Normal';
            const rowClass = isLow ? 'low-stock-flash-row' : '';
            const batchNo = `BAT-2026-${item.id.slice(-4)}`;

            const tr = document.createElement('tr');
            tr.className = rowClass;
            tr.innerHTML = `
                <td style="font-weight:700; color:var(--accent-blue)">${item.id}</td>
                <td style="font-weight:600; color:white">${item.item_name}</td>
                <td style="font-family:monospace; font-size:0.85rem;">${batchNo}</td>
                <td style="font-weight:700; ${isLow ? 'color:var(--accent-amber)' : ''}">${item.quantity} ${item.unit}</td>
                <td>${item.min_required} ${item.unit}</td>
                <td>
                    ${isLow 
                        ? `<span class="low-stock-badge-flashing"><i data-lucide="alert-triangle" style="width:12px; height:12px;"></i> ${statusText}</span>` 
                        : `<span class="badge-tag status-normal">${statusText}</span>`
                    }
                </td>
                <td>
                    <button class="primary-btn" style="padding: 5px 10px; font-size: 0.75rem;" onclick="promptUpdateStock('${item.id}', '${item.item_name}', ${item.quantity}, ${item.min_required}, '${item.unit}')">
                        <i data-lucide="edit-2" style="width: 10px; height: 10px; margin-right: 2px;"></i> Update Stock
                    </button>
                </td>
            `;
            tbody.appendChild(tr);

            const optDisp = document.createElement('option');
            optDisp.value = item.id;
            optDisp.innerText = `${item.item_name} (Avail: ${item.quantity} ${item.unit})`;
            selectDispense.appendChild(optDisp);

            if (selectIntake) {
                const optInt = document.createElement('option');
                optInt.value = item.id;
                optInt.innerText = `${item.item_name} (Current: ${item.quantity} ${item.unit})`;
                selectIntake.appendChild(optInt);
            }
        });

        if (prevDispenseVal) selectDispense.value = prevDispenseVal;
        if (selectIntake && prevIntakeVal) selectIntake.value = prevIntakeVal;
        
        lucide.createIcons();
        
        // Trigger alerts check & AI forecasts async
        checkInventoryAlerts();
        refreshAIForecast();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function checkInventoryAlerts() {
    try {
        const alerts = await apiFetch('/api/inventory/alerts');
        const localAlerts = alerts.filter(i => i.facility_id === facilityId);
        const banner = document.getElementById('pharmacist-low-stock-banner');
        const list = document.getElementById('low-stock-items-list');
        
        if (localAlerts.length > 0) {
            if (banner && list) {
                list.innerText = `Low stock on: ${localAlerts.map(i => `${i.item_name} (${i.quantity} ${i.unit})`).join(', ')}`;
                banner.style.display = 'flex';
            }
        } else {
            if (banner) banner.style.display = 'none';
        }
    } catch (err) {
        console.error("Alert check error:", err);
    }
}

window.refreshAIForecast = async function() {
    const container = document.getElementById('ai-forecast-container');
    if (!container) return;
    
    container.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100px; gap:8px;">
            <i data-lucide="loader" class="spin-icon" style="color:#a855f7;"></i>
            <span style="font-size:0.8rem; color:var(--text-muted)">Generating depletion analytics and forecast models...</span>
        </div>
    `;
    lucide.createIcons();
    
    try {
        const res = await apiFetch('/api/inventory/forecast');
        let html = res.forecast;
        // Simple markdown elements formatting
        html = html.replace(/### (.*)/g, '<h4 style="margin: 12px 0 6px 0; color: #a855f7;">$1</h4>');
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong style="color: white;">$1</strong>');
        html = html.replace(/-\s*(.*)/g, '<li style="margin-left: 15px; margin-bottom: 6px; list-style-type: square;">$1</li>');
        html = html.replace(/\n/g, '<br>');
        container.innerHTML = `<div style="font-size:0.85rem; color: var(--text-secondary); text-align: left;">${html}</div>`;
    } catch (err) {
        container.innerHTML = `<span style="color: var(--accent-crimson); font-size: 0.8rem;"><i data-lucide="alert-circle" style="display:inline-block; width:14px; height:14px; vertical-align:middle; margin-right:4px;"></i> Failed to generate AI forecast: ${err.message}</span>`;
    }
    lucide.createIcons();
}

window.submitShipmentIntake = async function(e) {
    e.preventDefault();
    const medicationId = document.getElementById('intake-medication-id').value;
    const batch = document.getElementById('intake-batch').value.trim();
    const expiry = document.getElementById('intake-expiry').value;
    const qty = parseInt(document.getElementById('intake-qty').value);
    
    try {
        await apiFetch('/api/inventory/intake', {
            method: 'POST',
            body: JSON.stringify({
                medication_id: medicationId,
                batch_number: batch,
                expiry_date: expiry,
                quantity_received: qty
            })
        });
        
        showToast(`Successfully logged intake of ${qty} units!`, 'success');
        document.getElementById('shipment-intake-form').reset();
        fetchPharmacistInventory();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

window.promptUpdateStock = async function(itemId, itemName, currentQty, currentMin, unit) {
    const newQtyStr = prompt(`Update stock quantity for ${itemName} (current: ${currentQty} ${unit}):`, currentQty);
    if (newQtyStr === null) return;
    const newQty = parseInt(newQtyStr);
    if (isNaN(newQty) || newQty < 0) {
        showToast('Invalid quantity value.', 'error');
        return;
    }
    
    const newMinStr = prompt(`Update safety threshold count for ${itemName} (current: ${currentMin} ${unit}):`, currentMin);
    if (newMinStr === null) return;
    const newMin = parseInt(newMinStr);
    if (isNaN(newMin) || newMin < 0) {
        showToast('Invalid safety threshold value.', 'error');
        return;
    }
    
    try {
        await apiFetch('/api/inventory', {
            method: 'POST',
            body: JSON.stringify({
                facility_id: facilityId,
                item_name: itemName,
                quantity: newQty,
                unit: unit,
                min_required: newMin
            })
        });
        showToast(`Stock updated for ${itemName}.`, 'success');
        fetchPharmacistInventory();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

window.submitPatientDispense = async function(e) {
    e.preventDefault();
    const errorBanner = document.getElementById('dispense-error-banner');
    const errorText = document.getElementById('dispense-error-text');
    if (errorBanner) errorBanner.style.display = 'none';

    const patientName = document.getElementById('dispense-patient-name').value.trim();
    const phone = document.getElementById('dispense-patient-phone').value.trim();
    const medicationId = document.getElementById('dispense-medication-id').value;
    const qty = parseInt(document.getElementById('dispense-qty').value);

    try {
        const res = await apiFetch('/api/dispense', {
            method: 'POST',
            body: JSON.stringify({
                patient_name: patientName,
                phone: phone,
                medication_id: medicationId,
                quantity: qty
            })
        });

        showToast(`Successfully dispensed ${qty} units of ${res.dispense_log.medication_name}!`, 'success');
        document.getElementById('patient-dispense-form').reset();
        fetchPharmacistInventory();
    } catch (err) {
        if (errorBanner && errorText) {
            errorText.innerText = err.message;
            errorBanner.style.display = 'block';
        }
        showToast(err.message, 'error');
    }
}

// R4. Nurse view data
async function fetchNurseDashboard() {
    try {
        const staff = await apiFetch('/api/staff').catch(() => []);
        const attendance = await apiFetch('/api/attendance').catch(() => []);
        const todayStr = new Date().toISOString().split('T')[0];

        const checkedInIds = attendance
            .filter(log => log.date === todayStr && log.check_in !== null && log.check_out === null && (log.status === 'Present' || log.status === 'GEOFENCE_VIOLATION'))
            .map(log => log.staff_id);

        const activeDocs = staff.filter(s => 
            s.facility_id === facilityId && 
            checkedInIds.includes(s.id) && 
            s.role.toLowerCase().includes('doctor')
        );

        const timesMap = {};
        attendance.forEach(log => {
            if (log.date === todayStr) timesMap[log.staff_id] = log.check_in;
        });

        const tbody = document.getElementById('nurse-doctors-table-body');
        tbody.innerHTML = '';

        if (activeDocs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="empty-state-cell" style="text-align:center;">No doctors clocked in today.</td></tr>`;
        } else {
            activeDocs.forEach(doc => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="font-weight:600; color:white;">${doc.name}</td>
                    <td>${doc.role}</td>
                    <td>${timesMap[doc.id] || '-'}</td>
                    <td><span class="badge-tag status-present">CLOCKED IN</span></td>
                `;
                tbody.appendChild(tr);
            });
        }

        const facilities = await apiFetch('/api/facilities');
        const currentFacility = facilities.find(f => f.id === facilityId);
        const gridNode = document.getElementById('nurse-beds-grid-nodes');
        gridNode.innerHTML = '';

        if (currentFacility) {
            const capacity = currentFacility.beds_capacity;
            const available = currentFacility.available_beds;
            const occupied = capacity - available;

            document.getElementById('nurse-avail-lbl').innerText = available;
            document.getElementById('nurse-occ-lbl').innerText = occupied;

            for (let i = 1; i <= capacity; i++) {
                const bed = document.createElement('div');
                const isOccupied = i <= occupied;
                bed.className = `nurse-bed-node ${isOccupied ? 'occupied' : 'available'}`;
                bed.innerHTML = `
                    <i data-lucide="bed"></i>
                    <div class="bed-tooltip">Bed Node #${i} - ${isOccupied ? 'Occupied (Active Patient)' : 'Vacant (Available)'}</div>
                `;
                gridNode.appendChild(bed);
            }
        }
        lucide.createIcons();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// R5. Staff dashboard stats
async function fetchStaffDashboardStats() {
    try {
        const stats = await apiFetch('/api/dashboard-stats');
        document.getElementById('staff-stat-facilities').innerText = stats.facilities_count;
        document.getElementById('staff-stat-beds').innerText = `${stats.occupied_beds} / ${stats.total_beds}`;
        document.getElementById('staff-stat-staff').innerText = stats.staff_count;
        document.getElementById('staff-stat-inventory').innerText = stats.low_stock_count;

        // Load and draw the staff competitive ranking leaderboard
        const analytics = await apiFetch('/api/admin/analytics');
        const tbody = document.getElementById('staff-leaderboard-tbody');
        if (tbody) {
            tbody.innerHTML = '';
            analytics.facilities_analytics.forEach((fac, idx) => {
                let badgeClass = '';
                let badgeLabel = '';
                if (fac.performance_tier === 'OPTIMAL_PERFORMANCE') {
                    badgeClass = 'status-optimal-ai';
                    badgeLabel = 'Optimal';
                } else if (fac.performance_tier === 'STRAINED_CAPACITY') {
                    badgeClass = 'status-strained-ai';
                    badgeLabel = 'Strained';
                } else {
                    badgeClass = 'status-critical-ai';
                    badgeLabel = 'Critical';
                }

                const tr = document.createElement('tr');
                const currentUsrFacilityId = localStorage.getItem('facilityId');
                if (fac.facility_id === currentUsrFacilityId) {
                    tr.style.background = 'rgba(251, 191, 36, 0.05)';
                    tr.style.borderLeft = '3px solid var(--accent-amber)';
                }

                tr.innerHTML = `
                    <td style="font-weight:700; color:white">#${idx + 1}</td>
                    <td style="font-weight:600; color:white">${fac.facility_name} ${fac.facility_id === currentUsrFacilityId ? '<span style="color:var(--accent-amber); font-size:0.75rem; margin-left:6px;">(Your Facility)</span>' : ''}</td>
                    <td style="font-weight:700; color:var(--accent-teal)">${fac.performance_score} / 100</td>
                    <td><span class="badge-tag ${badgeClass}">${badgeLabel}</span></td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (err) {
        console.error(err);
    }
}

// R6. Staff Facilities list
async function fetchStaffFacilitiesList() {
    try {
        const facilities = await apiFetch('/api/facilities');
        const container = document.getElementById('staff-facilities-list-container');
        container.innerHTML = '';

        facilities.forEach(fac => {
            const card = document.createElement('div');
            card.className = 'facility-card';
            let testsHtml = (fac.available_tests || []).map(t => `<span class="test-tag">${t}</span>`).join('');
            if (!testsHtml) testsHtml = '<span class="test-tag" style="opacity:0.5">None</span>';

            card.innerHTML = `
                <div class="facility-card-header">
                    <div>
                        <span class="badge-tag facility-type-tag type-${fac.type.toLowerCase()}">${fac.type}</span>
                        <h3 style="margin-top:6px;">${fac.name}</h3>
                    </div>
                    <span class="badge-tag info-tag">ID: ${fac.id}</span>
                </div>
                <div class="facility-card-detail">
                    <div class="fac-row"><i data-lucide="map-pin"></i><span>GPS: ${fac.lat}, ${fac.lon}</span></div>
                    <div class="fac-row"><i data-lucide="bed"></i><span>Available Beds: <strong>${fac.available_beds}</strong> / ${fac.beds_capacity}</span></div>
                </div>
                <div style="margin-top:10px;">
                    <h5 style="margin-bottom:6px; font-size:0.8rem; color:var(--text-muted)">Services</h5>
                    <div class="tests-tag-container">${testsHtml}</div>
                </div>
            `;
            container.appendChild(card);
        });
        lucide.createIcons();
    } catch (err) {
        console.error(err);
    }
}

// R7. Staff Global Admissions list
let cachedAdmissions = [];
let cachedFacMap = {};
let cachedUsrMap = {};
let cachedUsrPhoneMap = {};

async function fetchStaffAdmissionsList() {
    try {
        const admissions = await apiFetch('/api/admissions');
        const facilities = await apiFetch('/api/facilities').catch(() => []);
        const users = await apiFetch('/api/users').catch(() => []);

        cachedFacMap = {};
        facilities.forEach(f => cachedFacMap[f.id] = f.name);
        
        cachedUsrMap = {};
        cachedUsrPhoneMap = {};
        users.forEach(u => {
            cachedUsrMap[u.id] = u.name;
            cachedUsrPhoneMap[u.id] = u.contact || u.phone || '';
        });

        cachedAdmissions = admissions;

        // Clear any previous query on load
        const searchInput = document.getElementById('patient-search-bar');
        if (searchInput) {
            searchInput.value = '';
        }

        renderAdmissions(admissions);
    } catch (err) {
        console.error(err);
    }
}

function renderAdmissions(list) {
    const tbody = document.getElementById('staff-admissions-table-body');
    tbody.innerHTML = '';

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty-state-cell" style="text-align:center">No admissions logs.</td></tr>`;
        return;
    }

    list.forEach(adm => {
        const isBedOccupying = ['Admitted', 'Active'].includes(adm.status);
        const statusClass = isBedOccupying ? 'status-admitted' : 'status-discharged';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:700; color:var(--accent-blue)">${adm.id}</td>
            <td style="font-weight:600; color:white">${cachedUsrMap[adm.user_id] || adm.user_id}</td>
            <td>${cachedFacMap[adm.facility_id] || adm.facility_id}</td>
            <td>${adm.admission_date}</td>
            <td>${adm.discharge_date || '-'}</td>
            <td>${adm.reason}</td>
            <td><span class="badge-tag ${statusClass}">${adm.status}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

window.filterAdmissionsList = function() {
    const query = document.getElementById('patient-search-bar').value.toLowerCase().trim();
    if (!query) {
        renderAdmissions(cachedAdmissions);
        return;
    }
    
    const filtered = cachedAdmissions.filter(adm => {
        const patientName = (cachedUsrMap[adm.user_id] || "").toLowerCase();
        const patientPhone = (cachedUsrPhoneMap[adm.user_id] || "").toLowerCase();
        const userId = (adm.user_id || "").toLowerCase();
        
        return patientName.includes(query) || patientPhone.includes(query) || userId.includes(query);
    });
    
    renderAdmissions(filtered);
}

// ==============================================
// 5. SECURE API REQUEST WRAPPER & TOASTS
// ==============================================
async function apiFetch(url, options = {}) {
    const headers = {
        'X-Active-Role': activeRole,
        'X-User-Role': activeRole,
        'X-Staff-ID': staffId || '',
        'X-Device-Lat': deviceLat !== null ? String(deviceLat) : '',
        'X-Device-Lon': deviceLon !== null ? String(deviceLon) : '',
        ...options.headers
    };
    if (options.body && !(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    let retries = 0;
    const maxRetries = 3;
    while (true) {
        try {
            const response = await fetch(url, { ...options, headers });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.description || 'A network error occurred.');
            }
            return await response.json();
        } catch (err) {
            retries++;
            if (retries >= maxRetries) {
                console.error(`apiFetch failed after ${maxRetries} attempts for URL: ${url}. Error: ${err.message}`);
                if (url.includes('/api/dashboard-stats') || url.includes('/api/facilities') || url.includes('/api/staff')) {
                    console.warn("Clearing local storage session cache due to persistent transaction errors.");
                    localStorage.clear();
                }
                throw err;
            }
            console.warn(`apiFetch attempt ${retries} failed for URL: ${url}. Retrying in 300ms...`);
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    }
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle';
    else if (type === 'error') iconName = 'alert-octagon';
    else if (type === 'warning') iconName = 'alert-triangle';

    toast.innerHTML = `
        <i data-lucide="${iconName}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    lucide.createIcons();
    
    setTimeout(() => {
        toast.style.animation = 'fadeIn 0.25s ease reverse forwards';
        setTimeout(() => {
            if (toast.parentNode === container) {
                container.removeChild(toast);
            }
        }, 250);
    }, 4000);
}

// ==============================================
// 6. ADMIN MODAL HELPERS & SUBMISSIONS
// ==============================================
window.showModal = async function(modalId) {
    document.getElementById(modalId).style.display = 'flex';
    if (modalId === 'staff-modal') {
        const select = document.getElementById('stf-facility');
        select.innerHTML = '<option value="">-- Select Facility --</option>';
        const facilities = await apiFetch('/api/facilities').catch(() => []);
        facilities.forEach(f => {
            select.innerHTML += `<option value="${f.id}">${f.name}</option>`;
        });
    }
}

window.hideModal = function(modalId) {
    document.getElementById(modalId).style.display = 'none';
    const form = document.getElementById(modalId).querySelector('form');
    if (form) form.reset();
}

window.submitFacility = async function(e) {
    e.preventDefault();
    const testsStr = document.getElementById('fac-tests').value;
    const testsList = testsStr ? testsStr.split(',').map(t => t.trim()) : [];
    
    const body = {
        name: document.getElementById('fac-name').value,
        type: document.getElementById('fac-type').value,
        beds_capacity: parseInt(document.getElementById('fac-beds').value),
        lat: parseFloat(document.getElementById('fac-lat').value || 0),
        lon: parseFloat(document.getElementById('fac-lon').value || 0),
        tests_available: testsList
    };

    const id = document.getElementById('fac-id').value.trim();
    if (id) body.id = id;

    try {
        await apiFetch('/api/facilities', {
            method: 'POST',
            body: JSON.stringify(body)
        });
        showToast('Facility added successfully!', 'success');
        hideModal('facility-modal');
        fetchAdminData();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

window.submitUser = async function(e) {
    e.preventDefault();
    const body = {
        name: document.getElementById('usr-name').value,
        role: document.getElementById('usr-role').value,
        contact: document.getElementById('usr-contact').value,
        email: document.getElementById('usr-email').value
    };

    const id = document.getElementById('usr-id').value.trim();
    if (id) body.id = id;

    try {
        await apiFetch('/api/users', {
            method: 'POST',
            body: JSON.stringify(body)
        });
        showToast('User registry updated!', 'success');
        hideModal('user-modal');
        fetchAdminData();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

window.submitStaff = async function(e) {
    e.preventDefault();
    const body = {
        name: document.getElementById('stf-name').value,
        role: document.getElementById('stf-role').value,
        facility_id: document.getElementById('stf-facility').value,
        contact: document.getElementById('stf-contact').value,
        status: document.getElementById('stf-status').value
    };

    const id = document.getElementById('stf-id').value.trim();
    if (id) body.id = id;

    try {
        await apiFetch('/api/staff', {
            method: 'POST',
            body: JSON.stringify(body)
        });
        showToast('Staff registered successfully!', 'success');
        hideModal('staff-modal');
        fetchAdminData();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ==============================================
// 7. STAFF LOGIN SIMULATION BYPASS
// ==============================================
window.simulateStaffLogin = async function(targetStaffId) {
    try {
        showToast('Initializing login simulation...', 'info');
        
        const staff = await fetch('/api/staff', {
            headers: { 'X-Active-Role': 'Admin' }
        }).then(res => {
            if (!res.ok) throw new Error('Could not read staff registry');
            return res.json();
        });
        
        const targetStaff = staff.find(s => s.id === targetStaffId);
        if (!targetStaff) {
            showToast(`Staff member '${targetStaffId}' not found.`, 'error');
            return;
        }

        let facilities = await fetch('/api/facilities').then(res => res.json());
        let targetFacility = facilities.find(f => f.id === targetStaff.facility_id);

        if (!targetFacility) {
            showToast(`Assigned facility '${targetStaff.facility_id}' not found.`, 'error');
            return;
        }

        let token = targetFacility.daily_qr_token;
        if (!token) {
            showToast('No active token found. Generating QR tokens...', 'info');
            await fetch('/api/admin/generate-qr-tokens', {
                method: 'POST',
                headers: { 'X-Active-Role': 'Admin' }
            });
            facilities = await fetch('/api/facilities').then(res => res.json());
            targetFacility = facilities.find(f => f.id === targetStaff.facility_id);
            token = targetFacility ? targetFacility.daily_qr_token : null;
        }

        if (!token) {
            showToast('Failed to retrieve daily token for simulation.', 'error');
            return;
        }

        document.getElementById('auth-staff-id').value = targetStaffId;
        document.getElementById('auth-qr-token').value = token;
        
        const loginForm = document.getElementById('auth-form');
        loginForm.dispatchEvent(new Event('submit', { cancelable: true }));

    } catch (err) {
        showToast(`Simulation failed: ${err.message}`, 'error');
    }
}

// ==============================================
// 8. DISTRICT ADMIN WORKSPACE VIEW SWITCHER
// ==============================================
window.switchAdminFeature = function(featureVal) {
    const panels = document.querySelectorAll('.admin-feature-panel');
    panels.forEach(p => {
        p.style.display = 'none';
    });
    
    const activePanel = document.getElementById(`admin-panel-${featureVal}`);
    if (activePanel) {
        activePanel.style.display = 'block';
    }
}

