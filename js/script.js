
        // ============================================================
        // 🔧 SUPABASE CONFIG
        // ============================================================
        const SUPABASE_URL = 'https://tckxjugegelrewbucuof.supabase.co';
        const SUPABASE_ANON_KEY = 'sb_publishable_UCeNV7ypxmO6b17SD2btew_lk2uDvAV';

        let sb = null;
        try {
            if (window.supabase && window.supabase.createClient) {
                sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            }
        } catch (e) { console.error('Supabase init failed:', e); }

        // ============================================================
        // 🍬 SWEETALERT HELPERS
        // ============================================================sss
        const SWAL_BASE = {
            customClass: {
                popup: 'swal-kahoot-popup',
                title: 'swal-kahoot-title',
                htmlContainer: 'swal-kahoot-text',
                confirmButton: 'swal-kahoot-confirm',
                cancelButton: 'swal-kahoot-cancel'
            },
            buttonsStyling: false,
            reverseButtons: true
        };

        function swalToast(icon, title, timer = 2200) {
            return Swal.fire({
                toast: true, position: 'top-end', icon, title,
                showConfirmButton: false, timer, timerProgressBar: true,
                customClass: { popup: 'swal-toast-kahoot' }
            });
        }
        function swalSuccess(title, text = '') {
            return Swal.fire({
                ...SWAL_BASE, icon: 'success', title, text,
                confirmButtonText: '✨ Super !',
                customClass: { ...SWAL_BASE.customClass, confirmButton: 'swal-kahoot-confirm swal-kahoot-success' }
            });
        }
        function swalError(title, text = '') {
            return Swal.fire({ ...SWAL_BASE, icon: 'error', title, text, confirmButtonText: '😅 OK' });
        }
        async function swalConfirm(title, text = '', confirmText = 'Oui, confirmer', danger = false) {
            const r = await Swal.fire({
                ...SWAL_BASE, icon: 'question', title, text,
                showCancelButton: true,
                confirmButtonText: confirmText,
                cancelButtonText: 'Annuler',
                customClass: {
                    ...SWAL_BASE.customClass,
                    confirmButton: 'swal-kahoot-confirm' + (danger ? ' swal-kahoot-danger' : '')
                }
            });
            return r.isConfirmed;
        }
        async function swalCopyFallback(text) {
            const r = await Swal.fire({
                ...SWAL_BASE, icon: 'info', title: '📋 Copier ce lien',
                input: 'text', inputValue: text,
                confirmButtonText: '✅ Sélectionner tout'
            });
            return r.isConfirmed;
        }

        // ============================================================
        // STATE
        // ============================================================
        let currentUser = null;
        let currentProfile = null;
        let quizzes = [];
        let studentQuizzes = [];
        let myAttemptCounts = {};
        let responses = [];
        let currentQuiz = null;
        let currentQuestionIndex = 0;
        let studentAnswers = [];
        let editingQuizId = null;
        let assigningQuizId = null;
        let realtimeChannel = null;
        let allStudents = [];
        let allProfiles = {};
        let lastQuizForCelebration = null;
        let currentResponsesQuiz = null;
        let currentResponsesData = [];

        let quizStartedAt = null;
        let questionStartedAt = null;
        let questionTimes = [];
        let currentShareUrl = '';

        const $ = (id) => document.getElementById(id);

        // ============================================================
        // HELPERS
        // ============================================================
        function showBanner(targetId, msg, type = 'error') {
            const el = $(targetId);
            if (!el) return;
            const cls = type === 'success' ? 'success-banner' : type === 'info' ? 'info-banner' : 'error-banner';
            el.innerHTML = `<div class="${cls}">${msg}</div>`;
        }
        function clearBanner(targetId) { const el = $(targetId); if (el) el.innerHTML = ''; }
        function escapeHtml(s) {
            return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        }
        function escapeAttr(s) { return String(s ?? '').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
        function updateConnStatus(ok, text) {
            const s = $('connStatus'), t = $('connText');
            if (!s) return;
            s.classList.toggle('offline', !ok);
            t.textContent = text || (ok ? 'Connecté' : 'Déconnecté');
        }
        function formatDuration(seconds) {
            if (seconds === null || seconds === undefined) return '—';
            if (seconds < 60) return `${seconds}s`;
            const m = Math.floor(seconds / 60);
            const s = seconds % 60;
            return `${m}m ${s}s`;
        }
        function maxAttemptsLabel(n) {
            if (n === 0 || n === null || n === undefined) return '♾️ Illimité';
            if (n === 1) return '1️⃣ Une fois';
            return `${n}️⃣ ${n} fois`;
        }

        // ============================================================
        // AUTH TABS
        // ============================================================
        function switchAuthTab(tab) {
            clearBanner('authMessages');
            const loginForm = $('loginForm'), signupForm = $('signupForm');
            const loginTab = $('loginTab'), signupTab = $('signupTab');
            if (tab === 'login') {
                loginTab.classList.add('active'); signupTab.classList.remove('active');
                loginForm.classList.add('active'); signupForm.classList.remove('active');
            } else {
                signupTab.classList.add('active'); loginTab.classList.remove('active');
                signupForm.classList.add('active'); loginForm.classList.remove('active');
            }
        }

        // ============================================================
        // DOM WIRING
        // ============================================================
        window.addEventListener('DOMContentLoaded', () => {
            $('loginTab').addEventListener('click', () => switchAuthTab('login'));
            $('signupTab').addEventListener('click', () => switchAuthTab('signup'));
            $('switchToSignup').addEventListener('click', (e) => { e.preventDefault(); switchAuthTab('signup'); });
            $('switchToLogin').addEventListener('click', (e) => { e.preventDefault(); switchAuthTab('login'); });
            switchAuthTab('login');

            $('signupForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                clearBanner('authMessages');
                const firstName = $('signupFirstName').value.trim();
                const lastName = $('signupLastName').value.trim();
                const phone = $('signupPhone').value.trim();
                const email = $('signupEmail').value.trim();
                const password = $('signupPassword').value;
                const btn = $('signupSubmitBtn');

                if (!firstName || !lastName || !phone || !email || !password) { swalToast('warning', '⚠️ Remplis tous les champs'); return; }
                if (password.length < 6) { swalToast('warning', '⚠️ Mot de passe trop court'); return; }
                if (phone.replace(/\D/g, '').length < 6) { swalToast('warning', '⚠️ Téléphone invalide'); return; }
                if (!sb) { swalError('Supabase non configuré'); return; }

                btn.disabled = true;
                btn.innerHTML = '<span class="spinner"></span> Création du compte...';
                try {
                    const fullName = `${firstName} ${lastName}`;
                    const { data, error } = await sb.auth.signUp({
                        email, password,
                        options: { data: { first_name: firstName, last_name: lastName, full_name: fullName, phone, role: 'student' } }
                    });
                    if (error) throw error;
                    if (data.user) {
                        try {
                            await sb.from('profiles').upsert({
                                id: data.user.id, first_name: firstName, last_name: lastName,
                                phone, email, role: 'student'
                            });
                        } catch (pe) { console.warn('Profile upsert skipped:', pe.message); }
                    }
                    if (!data.session) {
                        swalSuccess('Compte créé ! 🎉', 'Vérifie ton email pour confirmer, puis connecte-toi.');
                        $('signupForm').reset();
                        setTimeout(() => switchAuthTab('login'), 2500);
                    } else {
                        swalSuccess('Compte créé ! 🎉', 'Connexion en cours...');
                    }
                } catch (err) {
                    swalError('Oups !', err.message);
                } finally {
                    btn.disabled = false;
                    btn.textContent = 'Créer mon compte';
                }
            });

            $('loginForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                clearBanner('authMessages');
                const email = $('loginEmail').value.trim();
                const password = $('loginPassword').value;
                const btn = $('loginSubmitBtn');
                if (!sb) { swalError('Supabase non configuré'); return; }
                btn.disabled = true;
                btn.innerHTML = '<span class="spinner"></span> Connexion...';
                try {
                    const { error } = await sb.auth.signInWithPassword({ email, password });
                    if (error) throw error;
                } catch (err) {
                    swalError('Connexion échouée', err.message);
                    btn.disabled = false;
                    btn.textContent = 'Se connecter';
                }
            });

            $('logoutBtn').addEventListener('click', async () => {
                const ok = await swalConfirm('Se déconnecter ?', 'Tu devras te reconnecter pour reprendre.', 'Oui, déconnexion', true);
                if (!ok) return;
                await sb.auth.signOut();
            });

            $('nextQuestionBtn').addEventListener('click', handleNextQuestion);
            $('backToListBtn').addEventListener('click', showStudentLobby);

            $('createQuizBtn').addEventListener('click', openCreateModal);
            $('cancelModalBtn').addEventListener('click', () => $('quizModal').classList.remove('active-modal'));
            $('addQuestionBtn').addEventListener('click', () => addQuestionField());
            $('saveQuizBtn').addEventListener('click', saveQuiz);

            $('closeStatsModal').addEventListener('click', () => $('statsModal').classList.remove('active-modal'));
            $('closeShareModal').addEventListener('click', () => $('shareModal').classList.remove('active-modal'));
            $('cancelAssignModal').addEventListener('click', () => $('assignModal').classList.remove('active-modal'));
            $('saveAssignBtn').addEventListener('click', saveAssignment);
            $('closeResponsesModal').addEventListener('click', () => $('responsesModal').classList.remove('active-modal'));

            $('celebrationClose').addEventListener('click', () => {
                $('celebrationOverlay').classList.remove('active');
                $('celebrationParticles').innerHTML = '';
                showStudentLobby();
            });
            $('celebrationRetake').addEventListener('click', () => {
                $('celebrationOverlay').classList.remove('active');
                $('celebrationParticles').innerHTML = '';
                if (lastQuizForCelebration) startQuiz(lastQuizForCelebration);
            });

            ['quizModal', 'statsModal', 'shareModal', 'assignModal', 'responsesModal'].forEach(id => {
                const m = $(id);
                if (m) m.addEventListener('click', (e) => { if (e.target === m) m.classList.remove('active-modal'); });
            });

            $('copyLinkBtn').addEventListener('click', async () => {
                if (!currentShareUrl) return;
                const copyBtn = $('copyLinkBtn');
                try {
                    await navigator.clipboard.writeText(currentShareUrl);
                    copyBtn.classList.add('copied');
                    copyBtn.querySelector('.copy-icon').textContent = '✅';
                    copyBtn.querySelector('.copy-label').textContent = 'Copié !';
                    setTimeout(() => {
                        copyBtn.classList.remove('copied');
                        copyBtn.querySelector('.copy-icon').textContent = '📋';
                        copyBtn.querySelector('.copy-label').textContent = 'Copier';
                    }, 1800);
                } catch {
                    await swalCopyFallback(currentShareUrl);
                }
            });

            // Search in responses modal
            $('respSearchInput').addEventListener('input', () => {
                renderResponsesModal();
            });

            document.querySelectorAll('.mode-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    if (btn.dataset.mode === 'admin' && currentProfile?.role !== 'admin') {
                        swalToast('warning', '⛔ Réservé aux admins');
                        return;
                    }
                    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    if (btn.dataset.mode === 'student') {
                        await showStudentLobby();
                    } else {
                        $('adminView').classList.add('active-view');
                        $('studentLobbyView').classList.remove('active-view');
                        $('studentQuizView').classList.remove('active-view');
                        await loadAdminData();
                        await loadGlobalStats();
                    }
                });
            });

            init();
        });

        // ============================================================
        // AUTH STATE
        // ============================================================
        async function handleAuthChange(session) {
            if (session?.user) {
                currentUser = session.user;
                const meta = session.user.user_metadata || {};
                currentProfile = {
                    id: session.user.id,
                    email: session.user.email,
                    first_name: meta.first_name || '',
                    last_name: meta.last_name || '',
                    full_name: meta.full_name || `${meta.first_name || ''} ${meta.last_name || ''}`.trim() || session.user.email,
                    phone: meta.phone || '',
                    role: meta.role || 'student'
                };
                await showMainApp();
            } else {
                currentUser = null; currentProfile = null;
                showAuthScreen();
            }
        }
        function showAuthScreen() {
            $('authContainer').style.display = 'block';
            $('mainApp').style.display = 'none';
            $('mainApp').classList.remove('active');
            switchAuthTab('login');
            if (realtimeChannel && sb) { sb.removeChannel(realtimeChannel); realtimeChannel = null; }
        }
        async function showMainApp() {
            $('authContainer').style.display = 'none';
            $('mainApp').style.display = 'block';
            $('mainApp').classList.add('active');
            $('userEmailDisplay').textContent = currentProfile.full_name || currentProfile.email;
            $('userRoleBadge').textContent = currentProfile.role;

            const isAdmin = currentProfile.role === 'admin';
            $('modeSwitchWrapper').style.display = isAdmin ? 'flex' : 'none';
            if (!isAdmin) {
                document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
                document.querySelector('[data-mode="student"]').classList.add('active');
            }

            try {
                updateConnStatus(true, 'Connecté');
                quizzes = await fetchQuizzes();
                // Load all profiles for admin (needed for responses viewer)
                if (isAdmin) await loadAllProfiles();

                if (isAdmin) {
                    document.querySelector('[data-mode="admin"]').classList.add('active');
                    document.querySelector('[data-mode="student"]').classList.remove('active');
                    $('adminView').classList.add('active-view');
                    $('studentLobbyView').classList.remove('active-view');
                    $('studentQuizView').classList.remove('active-view');
                    await loadAdminData();
                    await loadGlobalStats();
                } else {
                    await loadStudentQuizzes();
                }
                setupRealtime();
            } catch (err) {
                updateConnStatus(false, 'Erreur');
                showBanner('studentError', 'Erreur de chargement: ' + err.message);
            }
        }

        async function loadAllProfiles() {
            try {
                const { data, error } = await sb.from('profiles').select('*');
                if (error) throw error;
                allProfiles = {};
                (data || []).forEach(p => { allProfiles[p.id] = p; });
            } catch (err) {
                console.warn('Could not load profiles:', err.message);
                allProfiles = {};
            }
        }

        // ============================================================
        // SUPABASE CRUD
        // ============================================================
        async function fetchQuizzes() {
            const { data, error } = await sb.from('quizzes').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            return data || [];
        }
        async function createQuizInDB(quiz) {
            const { data, error } = await sb.from('quizzes').insert([{
                title: quiz.title, questions: quiz.questions,
                owner_id: currentUser.id, is_open: false,
                assigned_user_ids: [], max_attempts: quiz.max_attempts ?? 0
            }]).select().single();
            if (error) throw error;
            return data;
        }
        async function updateQuizInDB(id, quiz) {
            const { data, error } = await sb.from('quizzes').update({
                title: quiz.title, questions: quiz.questions,
                max_attempts: quiz.max_attempts ?? 0,
                updated_at: new Date().toISOString()
            }).eq('id', id).select().single();
            if (error) throw error;
            return data;
        }
        async function updateQuizAssignment(id, isOpen, assignedUserIds, maxAttempts) {
            const { data, error } = await sb.from('quizzes').update({
                is_open: isOpen, assigned_user_ids: assignedUserIds,
                max_attempts: maxAttempts ?? 0,
                updated_at: new Date().toISOString()
            }).eq('id', id).select().single();
            if (error) throw error;
            return data;
        }
        async function deleteQuizInDB(id) {
            const { error } = await sb.from('quizzes').delete().eq('id', id);
            if (error) throw error;
        }
        async function fetchResponses(quizId = null) {
            let query = sb.from('responses').select('*, quizzes(title)').order('created_at', { ascending: false }).limit(1000);
            if (quizId) query = query.eq('quiz_id', quizId);
            const { data, error } = await query;
            if (error) throw error;
            return data || [];
        }
        async function fetchMyAttemptCounts() {
            const { data, error } = await sb.from('responses').select('quiz_id').eq('user_id', currentUser.id);
            if (error) throw error;
            const counts = {};
            (data || []).forEach(r => { counts[r.quiz_id] = (counts[r.quiz_id] || 0) + 1; });
            return counts;
        }
        async function saveResponseInDB(quizId, answers, timing) {
            const { data, error } = await sb.from('responses').insert([{
                quiz_id: quizId, answers: answers,
                user_id: currentUser.id, user_email: currentProfile.email, user_name: currentProfile.full_name,
                started_at: timing.startedAt, finished_at: timing.finishedAt,
                duration_seconds: timing.durationSeconds, question_times: timing.questionTimes
            }]).select().single();
            if (error) throw error;
            return data;
        }
        async function fetchAllStudents() {
            const { data, error } = await sb.from('profiles').select('*').order('first_name', { ascending: true });
            if (error) {
                const { data: resp } = await sb.from('responses').select('user_id, user_name, user_email');
                const unique = {};
                (resp || []).forEach(r => {
                    if (r.user_id && !unique[r.user_id]) {
                        unique[r.user_id] = { id: r.user_id, full_name: r.user_name, email: r.user_email };
                    }
                });
                return Object.values(unique);
            }
            return (data || []).filter(p => p.role === 'student' || !p.role);
        }

        // ============================================================
        // REALTIME
        // ============================================================
        function setupRealtime() {
            if (!sb) return;
            if (realtimeChannel) sb.removeChannel(realtimeChannel);
            realtimeChannel = sb
                .channel('db-changes')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'quizzes' }, async () => {
                    quizzes = await fetchQuizzes();
                    if (currentProfile?.role === 'admin') renderAdminQuizList();
                    else await loadStudentQuizzes();
                })
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'responses' }, async () => {
                    if (currentProfile?.role === 'admin') {
                        loadGlobalStats();
                        // If the responses modal is open for this quiz, refresh it
                        if (currentResponsesQuiz) {
                            const payload = arguments[0];
                            await refreshResponsesModal(currentResponsesQuiz);
                        }
                    }
                })
                .subscribe((status) => {
                    updateConnStatus(status === 'SUBSCRIBED', status === 'SUBSCRIBED' ? 'Temps réel actif' : 'Reconnexion...');
                });
        }

        // ============================================================
        // STUDENT
        // ============================================================
        async function showStudentLobby() {
            $('studentLobbyView').classList.add('active-view');
            $('studentQuizView').classList.remove('active-view');
            $('adminView').classList.remove('active-view');
            clearBanner('studentError');
            await loadStudentQuizzes();
        }
        async function loadStudentQuizzes() {
            const grid = $('studentQuizGrid');
            grid.innerHTML = '<div class="loading">Chargement des quiz...</div>';
            try {
                const all = await fetchQuizzes();
                studentQuizzes = all.filter(q => {
                    if (!q.is_open) return false;
                    const assigned = q.assigned_user_ids || [];
                    if (assigned.length === 0) return true;
                    return assigned.includes(currentUser.id);
                });
                myAttemptCounts = await fetchMyAttemptCounts();
                renderStudentQuizGrid();
            } catch (err) {
                grid.innerHTML = '';
                showBanner('studentError', 'Impossible de charger les quiz: ' + err.message);
            }
        }
        function renderStudentQuizGrid() {
            const grid = $('studentQuizGrid');
            grid.innerHTML = '';
            if (studentQuizzes.length === 0) {
                grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                😴 Aucun quiz disponible pour le moment.<br>
                <small style="color:#a890c9;">Ton professeur ouvrira un quiz bientôt !</small>
            </div>`;
                return;
            }
            studentQuizzes.forEach(quiz => {
                const assigned = (quiz.assigned_user_ids || []).length > 0;
                const maxAttempts = quiz.max_attempts ?? 0;
                const attemptsDone = myAttemptCounts[quiz.id] || 0;
                const isDone = attemptsDone > 0;
                const isBlocked = maxAttempts > 0 && attemptsDone >= maxAttempts;

                const card = document.createElement('div');
                card.className = 'student-quiz-card' + (isDone ? ' done' : '');
                let tagsHtml = `<span class="tag ${assigned ? 'assigned' : ''}">${assigned ? '🎯 Assigné' : '🌍 Ouvert'}</span>`;
                if (maxAttempts === 0) tagsHtml += `<span class="tag unlimited">♾️ Illimité</span>`;
                else tagsHtml += `<span class="tag">${maxAttemptsLabel(maxAttempts)}</span>`;
                if (isDone && !isBlocked) tagsHtml += `<span class="tag done-tag">✓ Fait ${attemptsDone}×</span>`;
                if (isBlocked) tagsHtml += `<span class="tag blocked-tag">🔒 Bloqué</span>`;

                let buttonHtml;
                if (isBlocked) buttonHtml = `<button class="start-btn blocked" disabled>🔒 Tentatives épuisées</button>`;
                else if (isDone) buttonHtml = `<button class="start-btn retake">🔁 Refaire</button>`;
                else buttonHtml = `<button class="start-btn">🚀 Commencer</button>`;

                card.innerHTML = `
            <h3>${escapeHtml(quiz.title)}</h3>
            <p>${(quiz.questions || []).length} questions${isDone ? ` · ${attemptsDone} tentative${attemptsDone > 1 ? 's' : ''}` : ''}</p>
            <div class="tags">${tagsHtml}</div>
            ${buttonHtml}`;
                const btn = card.querySelector('.start-btn');
                if (!isBlocked) {
                    btn.addEventListener('click', (e) => { e.stopPropagation(); startQuiz(quiz); });
                    card.addEventListener('click', () => startQuiz(quiz));
                } else card.style.cursor = 'not-allowed';
                grid.appendChild(card);
            });
        }
        function startQuiz(quiz) {
            currentQuiz = quiz;
            currentQuestionIndex = 0;
            studentAnswers = new Array(quiz.questions.length).fill(null);
            quizStartedAt = new Date().toISOString();
            questionStartedAt = new Date().toISOString();
            questionTimes = [];
            $('studentLobbyView').classList.remove('active-view');
            $('studentQuizView').classList.add('active-view');
            renderStudentQuestion();
        }
        function renderStudentQuestion() {
            if (!currentQuiz || !currentQuiz.questions?.length) return;
            const q = currentQuiz.questions[currentQuestionIndex];
            if (!q) return;
            $('quizTitleDisplay').innerText = '📢 ' + currentQuiz.title;
            $('questionText').innerText = q.text || '';
            const imgEl = $('questionImage');
            if (q.image) { imgEl.src = q.image; imgEl.style.display = 'block'; }
            else imgEl.style.display = 'none';
            const optsDiv = $('optionsContainer');
            optsDiv.innerHTML = '';
            (q.options || []).forEach((opt, idx) => {
                const btn = document.createElement('button');
                btn.className = 'option-btn';
                btn.dataset.opt = idx;
                btn.innerText = opt;
                if (studentAnswers[currentQuestionIndex] === idx) btn.classList.add('selected');
                btn.addEventListener('click', () => selectAnswer(idx));
                optsDiv.appendChild(btn);
            });
            $('nextQuestionBtn').disabled = studentAnswers[currentQuestionIndex] === null;
            $('feedbackMsg').innerText = '';
            $('questionCounter').innerText = `${currentQuestionIndex + 1}/${currentQuiz.questions.length}`;
            $('progressInfo').innerText = `Question ${currentQuestionIndex + 1} / ${currentQuiz.questions.length}`;
        }
        function selectAnswer(optIndex) {
            studentAnswers[currentQuestionIndex] = optIndex;
            document.querySelectorAll('.option-btn').forEach(btn => {
                btn.classList.toggle('selected', parseInt(btn.dataset.opt) === optIndex);
            });
            $('feedbackMsg').innerText = '✅ Réponse enregistrée !';
            $('nextQuestionBtn').disabled = false;
        }
        async function handleNextQuestion() {
            if (!currentQuiz) return;
            const now = Date.now();
            const qStart = questionStartedAt ? new Date(questionStartedAt).getTime() : now;
            questionTimes.push({ qIndex: currentQuestionIndex, ms: now - qStart });
            if (currentQuestionIndex < currentQuiz.questions.length - 1) {
                currentQuestionIndex++;
                questionStartedAt = new Date().toISOString();
                renderStudentQuestion();
            } else {
                const answered = studentAnswers.filter(a => a !== null).length;
                if (answered === 0) return;
                $('nextQuestionBtn').disabled = true;
                $('feedbackMsg').innerText = '⏳ Envoi en cours...';
                const finishedAt = new Date().toISOString();
                const durationSeconds = quizStartedAt
                    ? Math.round((new Date(finishedAt) - new Date(quizStartedAt)) / 1000) : 0;
                try {
                    await saveResponseInDB(currentQuiz.id, studentAnswers, {
                        startedAt: quizStartedAt, finishedAt,
                        durationSeconds, questionTimes
                    });
                    myAttemptCounts[currentQuiz.id] = (myAttemptCounts[currentQuiz.id] || 0) + 1;
                    lastQuizForCelebration = currentQuiz;
                    triggerCelebration(durationSeconds, questionTimes);
                } catch (err) {
                    $('feedbackMsg').innerText = '❌ Erreur: ' + err.message;
                    swalError('Envoi échoué', err.message);
                    $('nextQuestionBtn').disabled = false;
                }
            }
        }

        // ============================================================
        // CELEBRATION
        // ============================================================
        function triggerCelebration(durationSeconds, qTimes) {
            const overlay = $('celebrationOverlay');
            const particles = $('celebrationParticles');
            const emojiEl = $('celebrationEmoji');
            const titleEl = $('celebrationTitle');
            const subEl = $('celebrationSubtitle');
            const statsEl = $('celebrationStats');
            const retakeBtn = $('celebrationRetake');

            const variants = [
                { emoji: '🎉', title: 'BRAVO !', sub: 'Tu as terminé le quiz !' },
                { emoji: '🏆', title: 'CHAMPION !', sub: 'Quiz complété avec succès !' },
                { emoji: '🌟', title: 'GÉNIAL !', sub: 'Tu es une star !' },
                { emoji: '🚀', title: 'EXCELLENT !', sub: 'Décollage réussi !' },
                { emoji: '🎊', title: 'FÉLICITATIONS !', sub: 'Tu as tout donné !' }
            ];
            const v = variants[Math.floor(Math.random() * variants.length)];
            emojiEl.textContent = v.emoji;
            titleEl.textContent = v.title;
            subEl.textContent = v.sub;

            const avgPerQ = qTimes.length > 0
                ? Math.round(qTimes.reduce((s, t) => s + t.ms, 0) / qTimes.length / 1000) : 0;
            statsEl.innerHTML = `
        <div class="celebration-stat">
            <div class="num">${formatDuration(durationSeconds)}</div>
            <div class="lbl">⏱️ Durée totale</div>
        </div>
        <div class="celebration-stat">
            <div class="num">${currentQuiz.questions.length}</div>
            <div class="lbl">❓ Questions</div>
        </div>
        <div class="celebration-stat">
            <div class="num">${formatDuration(avgPerQ)}</div>
            <div class="lbl">⚡ Moy. / question</div>
        </div>`;

            const maxAttempts = currentQuiz.max_attempts ?? 0;
            const attemptsDone = myAttemptCounts[currentQuiz.id] || 0;
            if (maxAttempts > 0 && attemptsDone >= maxAttempts) {
                retakeBtn.disabled = true;
                retakeBtn.textContent = '🔒 Tentatives épuisées';
            } else {
                retakeBtn.disabled = false;
                retakeBtn.textContent = '🔁 Refaire';
            }

            overlay.classList.add('active');
            particles.innerHTML = '';
            const colors = ['#ff7b9c', '#6ed4ff', '#b4ff9e', '#ffd966', '#a13eff', '#ff5e7c', '#4ecb71'];
            for (let i = 0; i < 120; i++) {
                const c = document.createElement('div');
                c.className = 'confetti';
                c.style.left = Math.random() * 100 + '%';
                c.style.background = colors[Math.floor(Math.random() * colors.length)];
                c.style.animationDuration = (2 + Math.random() * 3) + 's';
                c.style.animationDelay = (Math.random() * 1.5) + 's';
                c.style.transform = `rotate(${Math.random() * 360}deg)`;
                if (Math.random() > 0.5) c.style.borderRadius = '50%';
                particles.appendChild(c);
            }
            const balloonEmojis = ['🎈', '🎈', '🎈', '🎁', '⭐', '💜', '💚', '🧡'];
            for (let i = 0; i < 14; i++) {
                const b = document.createElement('div');
                b.className = 'balloon';
                b.textContent = balloonEmojis[Math.floor(Math.random() * balloonEmojis.length)];
                b.style.left = Math.random() * 100 + '%';
                b.style.animationDuration = (5 + Math.random() * 4) + 's';
                b.style.animationDelay = (Math.random() * 2) + 's';
                particles.appendChild(b);
            }
            setTimeout(() => {
                if (!overlay.classList.contains('active')) particles.innerHTML = '';
            }, 10000);
        }

        // ============================================================
        // ADMIN
        // ============================================================
        async function loadAdminData() {
            const container = $('quizListContainer');
            try {
                clearBanner('adminError');
                container.innerHTML = '<div class="loading">Chargement des quiz...</div>';
                quizzes = await fetchQuizzes();
                renderAdminQuizList();
            } catch (err) {
                container.innerHTML = '';
                showBanner('adminError', 'Impossible de charger les quiz: ' + err.message);
            }
        }
        function renderAdminQuizList() {
            const container = $('quizListContainer');
            container.innerHTML = '';
            if (quizzes.length === 0) {
                container.innerHTML = '<div class="empty-state">Aucun quiz. Cliquez sur "Nouveau quiz" pour commencer !</div>';
                return;
            }
            quizzes.forEach(quiz => {
                const isOpen = quiz.is_open === true;
                const assignedCount = (quiz.assigned_user_ids || []).length;
                const maxAttempts = quiz.max_attempts ?? 0;
                const card = document.createElement('div');
                card.className = 'quiz-card' + (isOpen ? '' : ' closed');
                card.innerHTML = `
            <div class="quiz-card-info">
                <h3>
                    ${escapeHtml(quiz.title)}
                    <span class="status-badge ${isOpen ? 'open' : 'closed'}">
                        ${isOpen ? '🟢 Ouvert' : '🔒 Fermé'}
                    </span>
                    ${assignedCount > 0 ? `<span class="status-badge assigned">🎯 ${assignedCount}</span>` : ''}
                    <span class="status-badge attempts">${maxAttempts === 0 ? '♾️ Illimité' : `${maxAttempts}×`}</span>
                </h3>
                <p>${(quiz.questions || []).length} questions</p>
            </div>
            <div class="quiz-card-actions">
                <button class="icon-btn toggle" data-id="${quiz.id}">${isOpen ? '🔒 Fermer' : '🟢 Ouvrir'}</button>
                <button class="icon-btn assign" data-id="${quiz.id}">🎯 Assigner</button>
                <button class="icon-btn share" data-id="${quiz.id}">🔗 Partager</button>
                <button class="icon-btn responses" data-id="${quiz.id}">📋 Réponses</button>
                <button class="icon-btn view" data-id="${quiz.id}">📊 Stats</button>
                <button class="icon-btn edit" data-id="${quiz.id}">✏️</button>
                <button class="icon-btn delete" data-id="${quiz.id}">🗑️</button>
            </div>`;
                container.appendChild(card);
            });

            // Wire actions
            container.querySelectorAll('.toggle').forEach(btn => btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.dataset.id;
                const quiz = quizzes.find(q => q.id === id);
                if (!quiz) return;
                try {
                    await updateQuizAssignment(id, !quiz.is_open, quiz.assigned_user_ids || [], quiz.max_attempts ?? 0);
                    swalToast('success', `Quiz ${!quiz.is_open ? 'ouvert 🟢' : 'fermé 🔒'}`);
                    await loadAdminData();
                } catch (err) { swalError('Erreur', err.message); }
            }));
            container.querySelectorAll('.assign').forEach(btn => btn.addEventListener('click', (e) => {
                openAssignModal(e.currentTarget.dataset.id);
            }));
            container.querySelectorAll('.share').forEach(btn => btn.addEventListener('click', (e) => {
                openShareModal(e.currentTarget.dataset.id);
            }));
            container.querySelectorAll('.responses').forEach(btn => btn.addEventListener('click', (e) => {
                openResponsesModal(e.currentTarget.dataset.id);
            }));
            container.querySelectorAll('.view').forEach(btn => btn.addEventListener('click', (e) => showQuizStats(e.currentTarget.dataset.id)));
            container.querySelectorAll('.edit').forEach(btn => btn.addEventListener('click', (e) => openEditModal(e.currentTarget.dataset.id)));
            container.querySelectorAll('.delete').forEach(btn => btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.dataset.id;
                const quiz = quizzes.find(q => q.id === id);
                const ok = await swalConfirm(
                    'Supprimer ce quiz ?',
                    `"${quiz?.title || 'Ce quiz'}" sera définitivement supprimé avec toutes ses réponses.`,
                    'Oui, supprimer', true
                );
                if (!ok) return;
                try {
                    await deleteQuizInDB(id);
                    swalToast('success', 'Quiz supprimé 🗑️');
                    await loadAdminData();
                    await loadGlobalStats();
                } catch (err) { swalError('Erreur', err.message); }
            }));
        }

        // ============================================================
        // 📋 RESPONSES MODAL (NEW)
        // ============================================================
        async function openResponsesModal(quizId) {
            const quiz = quizzes.find(q => q.id === quizId);
            if (!quiz) return;
            currentResponsesQuiz = quiz;
            $('responsesModalTitle').textContent = `📋 Réponses — ${quiz.title}`;
            $('respSearchInput').value = '';
            $('responsesModalContent').innerHTML = '<div class="loading">Chargement des réponses...</div>';
            $('responsesModal').classList.add('active-modal');
            await refreshResponsesModal(quiz);
        }

        async function refreshResponsesModal(quiz) {
            try {
                // Fetch all responses for this quiz
                const { data, error } = await sb
                    .from('responses')
                    .select('*')
                    .eq('quiz_id', quiz.id)
                    .order('created_at', { ascending: false });
                if (error) throw error;
                currentResponsesData = data || [];

                // Make sure profiles are loaded
                if (Object.keys(allProfiles).length === 0) {
                    await loadAllProfiles();
                }
                renderResponsesModal();
            } catch (err) {
                $('responsesModalContent').innerHTML = `<div class="error-banner">Erreur: ${err.message}</div>`;
            }
        }

        function renderResponsesModal() {
            const content = $('responsesModalContent');
            const query = ($('respSearchInput').value || '').trim().toLowerCase();
            const quiz = currentResponsesQuiz;
            if (!quiz) return;

            if (currentResponsesData.length === 0) {
                content.innerHTML = '<div class="empty-state">😴 Aucune réponse pour ce quiz pour le moment.</div>';
                return;
            }

            // Group responses by user_id
            const byUser = {};
            currentResponsesData.forEach(r => {
                const uid = r.user_id || r.user_email || 'unknown';
                if (!byUser[uid]) {
                    byUser[uid] = {
                        user_id: r.user_id,
                        user_name: r.user_name || 'Anonyme',
                        user_email: r.user_email || '',
                        attempts: []
                    };
                }
                byUser[uid].attempts.push(r);
            });

            // Build list of students
            let students = Object.values(byUser);

            // Filter by search query
            if (query) {
                students = students.filter(s =>
                    (s.user_name || '').toLowerCase().includes(query) ||
                    (s.user_email || '').toLowerCase().includes(query)
                );
            }

            if (students.length === 0) {
                content.innerHTML = `<div class="empty-state">🔍 Aucun étudiant ne correspond à "${escapeHtml(query)}".</div>`;
                return;
            }

            // Sort by most recent attempt
            students.sort((a, b) => {
                const aLast = new Date(a.attempts[0]?.created_at || 0);
                const bLast = new Date(b.attempts[0]?.created_at || 0);
                return bLast - aLast;
            });

            let html = '';
            students.forEach(s => {
                const profile = allProfiles[s.user_id] || {};
                const phone = profile.phone || '—';
                const firstName = profile.first_name || '';
                const lastName = profile.last_name || '';
                const email = s.user_email || profile.email || '—';

                // Sort attempts newest first
                s.attempts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                const attemptCount = s.attempts.length;
                const durations = s.attempts.map(a => a.duration_seconds).filter(d => d != null);
                const bestDuration = durations.length > 0 ? Math.min(...durations) : null;
                const lastAttempt = s.attempts[0];

                html += `
            <div class="student-resp-card">
                <div class="student-resp-header">
                    <div>
                        <div class="student-resp-name">
                            👤 ${escapeHtml(s.user_name)}
                        </div>
                        <div class="student-resp-meta">
                            📧 ${escapeHtml(email)} &nbsp;·&nbsp; 📱 ${escapeHtml(phone)}
                        </div>
                    </div>
                    <div class="student-resp-badges">
                        <span class="resp-badge attempts">🎯 ${attemptCount} tentative${attemptCount > 1 ? 's' : ''}</span>
                        ${bestDuration != null ? `<span class="resp-badge duration">⚡ Best ${formatDuration(bestDuration)}</span>` : ''}
                    </div>
                </div>
        `;

                // Show each attempt
                s.attempts.forEach((attempt, idx) => {
                    const attemptNum = attemptCount - idx; // newest = highest number
                    const dur = formatDuration(attempt.duration_seconds);
                    const when = new Date(attempt.created_at).toLocaleString('fr-FR');
                    const answers = attempt.answers || [];

                    html += `
                <div class="attempt-block">
                    <div class="attempt-header">
                        <div class="attempt-title">🎯 Tentative #${attemptNum}</div>
                        <div class="attempt-meta">⏱️ ${dur} · ${when}</div>
                    </div>
            `;

                    (quiz.questions || []).forEach((q, qi) => {
                        const answerIdx = answers[qi];
                        let choiceText = '<span class="q-answer-choice none">— Pas de réponse —</span>';
                        if (answerIdx !== null && answerIdx !== undefined && q.options?.[answerIdx] !== undefined) {
                            choiceText = `<span class="q-answer-choice">${escapeHtml(q.options[answerIdx])}</span>`;
                        }
                        html += `
                    <div class="q-answer-row">
                        <div class="q-answer-num">${qi + 1}</div>
                        <div class="q-answer-body">
                            <div class="q-answer-question">${escapeHtml(q.text)}</div>
                            ${choiceText}
                        </div>
                    </div>
                `;
                    });

                    html += `</div>`;
                });

                html += `</div>`;
            });

            content.innerHTML = html;
        }

        // ============================================================
        // ASSIGN MODAL
        // ============================================================
        async function openAssignModal(quizId) {
            const quiz = quizzes.find(q => q.id === quizId);
            if (!quiz) return;
            assigningQuizId = quizId;
            $('assignModalTitle').textContent = `🎯 ${quiz.title}`;
            $('assignOpenToggle').checked = quiz.is_open === true;
            $('assignMaxAttempts').value = String(quiz.max_attempts ?? 0);

            const picker = $('assignUserPicker');
            picker.innerHTML = '<div class="loading" style="padding:1rem; color:#7a5e9a;">Chargement des étudiants...</div>';
            try {
                allStudents = await fetchAllStudents();
                const assigned = quiz.assigned_user_ids || [];
                picker.innerHTML = '';
                if (allStudents.length === 0) {
                    picker.innerHTML = '<div class="empty-state" style="color:#7a5e9a; padding:1rem;">Aucun étudiant inscrit pour le moment.</div>';
                } else {
                    allStudents.forEach(s => {
                        const name = s.full_name || `${s.first_name || ''} ${s.last_name || ''}`.trim() || s.email || 'Étudiant';
                        const checked = assigned.includes(s.id);
                        const item = document.createElement('label');
                        item.className = 'user-picker-item' + (checked ? ' checked' : '');
                        item.innerHTML = `
                    <input type="checkbox" value="${s.id}" ${checked ? 'checked' : ''}>
                    <div>
                        <div class="user-name">${escapeHtml(name)}</div>
                        <div class="user-meta">${escapeHtml(s.email || s.phone || '')}</div>
                    </div>`;
                        const cb = item.querySelector('input');
                        cb.addEventListener('change', () => item.classList.toggle('checked', cb.checked));
                        picker.appendChild(item);
                    });
                }
            } catch (err) {
                picker.innerHTML = `<div class="error-banner" style="margin:0;">Erreur: ${err.message}</div>`;
            }
            $('assignModal').classList.add('active-modal');
        }
        async function saveAssignment() {
            if (!assigningQuizId) return;
            const isOpen = $('assignOpenToggle').checked;
            const maxAttempts = parseInt($('assignMaxAttempts').value, 10) || 0;
            const checked = Array.from($('assignUserPicker').querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
            const btn = $('saveAssignBtn');
            btn.disabled = true;
            btn.textContent = '⏳ Enregistrement...';
            try {
                await updateQuizAssignment(assigningQuizId, isOpen, checked, maxAttempts);
                $('assignModal').classList.remove('active-modal');
                swalToast('success', 'Assignation enregistrée ✅');
                await loadAdminData();
            } catch (err) {
                swalError('Erreur', err.message);
            } finally {
                btn.disabled = false;
                btn.textContent = '💾 Enregistrer';
            }
        }

        // ============================================================
        // SHARE MODAL
        // ============================================================
        function openShareModal(quizId) {
            const quiz = quizzes.find(q => q.id === quizId);
            if (!quiz) return;
            currentShareUrl = `${window.location.origin}${window.location.pathname}?quiz=${quizId}`;
            $('shareQuizTitle').textContent = '📢 ' + quiz.title;
            $('shareLinkInput').value = currentShareUrl;
            const copyBtn = $('copyLinkBtn');
            copyBtn.classList.remove('copied');
            copyBtn.querySelector('.copy-icon').textContent = '📋';
            copyBtn.querySelector('.copy-label').textContent = 'Copier';
            const qrContainer = $('shareQrCode');
            qrContainer.innerHTML = '';
            if (window.QRCode) {
                try {
                    new QRCode(qrContainer, {
                        text: currentShareUrl, width: 160, height: 160,
                        colorDark: '#2a0e45', colorLight: '#ffffff',
                        correctLevel: QRCode.CorrectLevel.H
                    });
                } catch (e) { console.warn('QR failed:', e); }
            }
            const msg = encodeURIComponent(`🎮 Rejoins mon quiz "${quiz.title}" sur Kahoot Clone !\n${currentShareUrl}`);
            $('shareWhatsapp').href = `https://wa.me/?text=${msg}`;
            $('shareEmail').href = `mailto:?subject=${encodeURIComponent('Quiz : ' + quiz.title)}&body=${msg}`;
            $('shareSms').href = `sms:?&body=${msg}`;
            const nativeBtn = $('shareNative');
            if (navigator.share) {
                nativeBtn.style.display = 'flex';
                nativeBtn.onclick = async () => {
                    try {
                        await navigator.share({ title: quiz.title, text: `Rejoins mon quiz "${quiz.title}" !`, url: currentShareUrl });
                    } catch (err) { }
                };
            } else nativeBtn.style.display = 'none';
            $('shareModal').classList.add('active-modal');
        }

        // ============================================================
        // GLOBAL STATS
        // ============================================================
        async function loadGlobalStats() {
            const container = $('statsContainer');
            container.innerHTML = '<div class="loading">Calcul des statistiques...</div>';
            try {
                const allResp = await fetchResponses();
                if (allResp.length === 0) {
                    container.innerHTML = '<div class="empty-state">Aucune réponse pour le moment.</div>';
                    return;
                }
                const totalResponses = allResp.length;
                const uniqueStudents = new Set(allResp.map(r => r.user_id).filter(Boolean)).size;
                const durations = allResp.map(r => r.duration_seconds).filter(d => d !== null && d !== undefined);
                const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
                const fastestDuration = durations.length > 0 ? Math.min(...durations) : null;
                const slowestDuration = durations.length > 0 ? Math.max(...durations) : null;
                const uniqueQuizzes = new Set(allResp.map(r => r.quiz_id)).size;
                container.innerHTML = `
            <div class="stat-grid">
                <div class="stat-card"><div class="num">${totalResponses}</div><div class="lbl">📝 Réponses</div></div>
                <div class="stat-card"><div class="num">${uniqueStudents}</div><div class="lbl">👥 Étudiants</div></div>
                <div class="stat-card"><div class="num">${uniqueQuizzes}</div><div class="lbl">🎯 Quiz répondus</div></div>
                <div class="stat-card"><div class="num">${formatDuration(avgDuration)}</div><div class="lbl">⏱️ Durée moy.</div></div>
                <div class="stat-card"><div class="num">${formatDuration(fastestDuration)}</div><div class="lbl">⚡ Plus rapide</div></div>
                <div class="stat-card"><div class="num">${formatDuration(slowestDuration)}</div><div class="lbl">🐢 Plus lent</div></div>
            </div>
            <div class="chart-section">
                <h4>🕐 Réponses récentes</h4>
                <div id="recentResponsesList"></div>
            </div>`;
                const recentList = $('recentResponsesList');
                allResp.slice(0, 8).forEach(r => {
                    const div = document.createElement('div');
                    div.className = 'response-item';
                    const title = r.quizzes?.title || 'Quiz';
                    const who = r.user_name || r.user_email || 'Anonyme';
                    const dur = formatDuration(r.duration_seconds);
                    const when = new Date(r.created_at).toLocaleString('fr-FR');
                    div.innerHTML = `<span class="who">📝 ${escapeHtml(title)} · ${escapeHtml(who)}</span>
                             <span class="time">⏱️ ${dur} · ${when}</span>`;
                    recentList.appendChild(div);
                });
            } catch (err) {
                container.innerHTML = `<div class="error-banner">Erreur: ${err.message}</div>`;
            }
        }

        // ============================================================
        // PER-QUIZ STATS
        // ============================================================
        async function showQuizStats(quizId) {
            const modal = $('statsModal');
            const content = $('statsModalContent');
            const title = $('statsModalTitle');
            content.innerHTML = '<div class="loading">Chargement...</div>';
            modal.classList.add('active-modal');
            try {
                const quiz = quizzes.find(q => q.id === quizId);
                const resp = await fetchResponses(quizId);
                title.textContent = `📊 ${quiz?.title || 'Statistiques'}`;
                if (resp.length === 0) {
                    content.innerHTML = '<div class="empty-state">Aucune réponse pour ce quiz.</div>';
                    return;
                }
                const total = resp.length;
                const uniqueStudents = new Set(resp.map(r => r.user_id).filter(Boolean)).size;
                const durations = resp.map(r => r.duration_seconds).filter(d => d !== null && d !== undefined);
                const avgDur = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
                const minDur = durations.length > 0 ? Math.min(...durations) : 0;
                const maxDur = durations.length > 0 ? Math.max(...durations) : 0;
                const qCounts = quiz.questions.map((q, i) => {
                    const counts = new Array(q.options.length).fill(0);
                    resp.forEach(r => {
                        const ans = (r.answers || [])[i];
                        if (ans !== null && ans !== undefined && counts[ans] !== undefined) counts[ans]++;
                    });
                    return { question: q.text, options: q.options, counts };
                });
                const qTimeSum = {};
                const qTimeCount = {};
                resp.forEach(r => {
                    (r.question_times || []).forEach(qt => {
                        if (!qTimeSum[qt.qIndex]) { qTimeSum[qt.qIndex] = 0; qTimeCount[qt.qIndex] = 0; }
                        qTimeSum[qt.qIndex] += qt.ms;
                        qTimeCount[qt.qIndex]++;
                    });
                });
                let html = `
            <div class="stat-grid">
                <div class="stat-card"><div class="num">${total}</div><div class="lbl">📝 Réponses</div></div>
                <div class="stat-card"><div class="num">${uniqueStudents}</div><div class="lbl">👥 Étudiants</div></div>
                <div class="stat-card"><div class="num">${formatDuration(avgDur)}</div><div class="lbl">⏱️ Durée moy.</div></div>
                <div class="stat-card"><div class="num">${formatDuration(minDur)}</div><div class="lbl">⚡ Plus rapide</div></div>
                <div class="stat-card"><div class="num">${formatDuration(maxDur)}</div><div class="lbl">🐢 Plus lent</div></div>
            </div>`;
                qCounts.forEach((qc, qi) => {
                    const totalForQ = qc.counts.reduce((a, b) => a + b, 0);
                    const avgMs = qTimeCount[qi] ? Math.round(qTimeSum[qi] / qTimeCount[qi]) : 0;
                    html += `
                <div class="chart-section">
                    <h4>❓ Q${qi + 1} — ${escapeHtml(qc.question)}</h4>
                    <div style="font-size:0.85rem; color:#6ed4ff; margin-bottom:0.8rem;">
                        ⏱️ Temps moyen : ${formatDuration(Math.round(avgMs / 1000))}
                    </div>`;
                    qc.options.forEach((opt, oi) => {
                        const count = qc.counts[oi];
                        const pct = totalForQ > 0 ? Math.round((count / totalForQ) * 100) : 0;
                        html += `
                    <div class="bar-row">
                        <div class="label">${escapeHtml(opt)}</div>
                        <div class="bar-wrap"><div class="bar-fill" style="width: ${pct}%;">${pct}%</div></div>
                        <div class="count">${count}</div>
                    </div>`;
                    });
                    html += `</div>`;
                });
                html += `<div class="chart-section"><h4>🕐 Derniers répondants</h4>`;
                resp.slice(0, 10).forEach(r => {
                    const who = r.user_name || r.user_email || 'Anonyme';
                    const dur = formatDuration(r.duration_seconds);
                    const when = new Date(r.created_at).toLocaleString('fr-FR');
                    html += `
                <div class="response-item">
                    <span class="who">${escapeHtml(who)}</span>
                    <span class="time">⏱️ ${dur} · ${when}</span>
                </div>`;
                });
                html += `</div>`;
                content.innerHTML = html;
            } catch (err) {
                content.innerHTML = `<div class="error-banner">Erreur: ${err.message}</div>`;
            }
        }

        // ============================================================
        // QUIZ MODAL
        // ============================================================
        function openCreateModal() {
            editingQuizId = null;
            $('modalTitle').innerText = 'Créer un quiz';
            $('quizTitleInput').value = '';
            $('quizMaxAttempts').value = '0';
            $('questionsContainer').innerHTML = '';
            addQuestionField();
            $('quizModal').classList.add('active-modal');
        }
        function addQuestionField(question = null) {
            const questionsContainer = $('questionsContainer');
            const qDiv = document.createElement('div');
            qDiv.className = 'form-group';
            qDiv.style.background = '#e0d0ff';
            qDiv.style.padding = '1rem';
            qDiv.style.borderRadius = '30px';
            qDiv.style.marginBottom = '1rem';
            const qText = question?.text || '';
            const qImage = question?.image || '';
            const opts = question?.options?.length ? question.options : ['', '', '', ''];
            qDiv.innerHTML = `
        <label>❓ Question</label>
        <input type="text" class="q-text-input" value="${escapeAttr(qText)}" placeholder="Intitulé">
        <label style="margin-top:0.5rem;">🖼️ URL image (optionnel)</label>
        <input type="text" class="q-image-input" value="${escapeAttr(qImage)}" placeholder="https://...">
        <label style="margin-top:0.5rem;">🔘 Options (min 2)</label>
        <div class="options-wrapper"></div>
        <button type="button" class="icon-btn remove-q" style="background:#ff5e7c; margin-top:0.5rem;">Supprimer la question</button>`;
            const optionsWrapper = qDiv.querySelector('.options-wrapper');
            opts.forEach(opt => addOptionRow(optionsWrapper, opt));
            const addOptBtn = document.createElement('button');
            addOptBtn.type = 'button';
            addOptBtn.className = 'icon-btn';
            addOptBtn.style.marginTop = '0.5rem';
            addOptBtn.innerText = '➕ Ajouter une option';
            addOptBtn.addEventListener('click', () => addOptionRow(optionsWrapper, ''));
            optionsWrapper.after(addOptBtn);
            qDiv.querySelector('.remove-q').addEventListener('click', () => qDiv.remove());
            questionsContainer.appendChild(qDiv);
        }
        function addOptionRow(wrapper, value) {
            const row = document.createElement('div');
            row.className = 'option-row';
            row.innerHTML = `
        <input type="text" class="opt-input" value="${escapeAttr(value)}" placeholder="Option">
        <button type="button" class="remove-opt">✖</button>`;
            row.querySelector('.remove-opt').addEventListener('click', () => {
                if (wrapper.children.length > 2) row.remove();
            });
            wrapper.appendChild(row);
        }
        async function saveQuiz() {
            const title = $('quizTitleInput').value.trim() || 'Quiz sans titre';
            const max_attempts = parseInt($('quizMaxAttempts').value, 10) || 0;
            const questionDivs = $('questionsContainer').querySelectorAll('.form-group');
            const questions = [];
            questionDivs.forEach(div => {
                const text = div.querySelector('.q-text-input').value.trim();
                const image = div.querySelector('.q-image-input').value.trim();
                const options = [];
                div.querySelectorAll('.opt-input').forEach(inp => {
                    const v = inp.value.trim();
                    if (v) options.push(v);
                });
                if (text && options.length >= 2) questions.push({ text, image, options });
            });
            if (questions.length === 0) { swalToast('warning', '⚠️ Ajoute au moins 1 question avec 2 options'); return; }
            const saveBtn = $('saveQuizBtn');
            saveBtn.disabled = true;
            saveBtn.innerText = '⏳ Enregistrement...';
            try {
                if (editingQuizId) await updateQuizInDB(editingQuizId, { title, questions, max_attempts });
                else await createQuizInDB({ title, questions, max_attempts });
                $('quizModal').classList.remove('active-modal');
                swalToast('success', editingQuizId ? 'Quiz modifié ✅' : 'Quiz créé 🎉');
                await loadAdminData();
                await loadGlobalStats();
            } catch (err) { swalError('Erreur', err.message); }
            finally { saveBtn.disabled = false; saveBtn.innerText = '💾 Enregistrer'; }
        }
        function openEditModal(quizId) {
            const quiz = quizzes.find(q => q.id === quizId);
            if (!quiz) return;
            editingQuizId = quizId;
            $('modalTitle').innerText = 'Modifier le quiz';
            $('quizTitleInput').value = quiz.title;
            $('quizMaxAttempts').value = String(quiz.max_attempts ?? 0);
            $('questionsContainer').innerHTML = '';
            (quiz.questions || []).forEach(q => addQuestionField(q));
            $('quizModal').classList.add('active-modal');
        }

        // ============================================================
        // INIT
        // ============================================================
        async function init() {
            if (!sb) {
                showBanner('authMessages', '⚠️ Configurez SUPABASE_URL et SUPABASE_ANON_KEY dans le script.');
                return;
            }
            sb.auth.onAuthStateChange((event, session) => { handleAuthChange(session); });
            const { data: { session } } = await sb.auth.getSession();
            await handleAuthChange(session);
        }
