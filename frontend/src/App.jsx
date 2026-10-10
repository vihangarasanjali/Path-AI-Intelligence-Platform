import { useMemo, useState } from 'react';
import {
  Briefcase, UserRound, Target, Layers, Bot, Compass, Lock,
  Loader2, CheckCircle2, AlertCircle, RotateCcw, GraduationCap, MapPin,
  Award, Clock, ArrowRight, Check, Minus,
} from 'lucide-react';
import './App.css';

const API_URL = 'http://localhost:5000/api/job-matching/predict';

// Order matters: it must match the skill column order the model was trained on.
const SKILLS = [
  { key: 'programming', label: 'Programming' },
  { key: 'databaseSql', label: 'Database / SQL' },
  { key: 'versionControl', label: 'Version Control (Git)' },
  { key: 'problemSolving', label: 'Problem Solving' },
  { key: 'communication', label: 'Communication' },
];

const PROGRAMS = [
  'Web Development', 'Computer Science and Engineering', 'AI Engineering',
  'Software Engineering', 'Information Technology', 'Data Science', 'Cybersecurity'
];
const JOB_TITLES = [
  'Data Analyst', 'Security Analyst', 'QA Engineer', 'Frontend Developer',
  'ML Engineer', 'DevOps Engineer', 'Mobile App Developer', 'AI Engineer'
];
const LOCATIONS = ['Bangalore', 'Hyderabad', 'Pune', 'Chennai', 'Mumbai', 'Delhi'];

const initialForm = {
  age: '', gender: '', DegreeProgram: '', cgpa: '',
  certificationsCount: '', internshipExperience: '',
  skills: SKILLS.map(() => 0),
  jobTitle: '', requiredSkills: SKILLS.map(() => 0),
  minExperienceMonths: '', location: '',
};

const modules = [
  { id: 'match', label: 'Job Match', icon: Target, status: 'active' },
  { id: 'recommend', label: 'Recommendations', icon: Compass, status: 'soon' },
  { id: 'genai', label: 'Career Assistant', icon: Bot, status: 'soon' },
];

// Probability bands: 80-100 Strong, 50-79 Moderate, 0-49 Weak
function getTier(p) {
  if (p >= 0.8) return { name: 'Strong match', tone: 'good' };
  if (p >= 0.5) return { name: 'Moderate match', tone: 'mid' };
  return { name: 'Weak match', tone: 'low' };
}

function Field({ label, icon: Icon, children, hint }) {
  return (
    <label className="field">
      <span className="field-label">
        {Icon && <Icon size={14} />}
        {label}
      </span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

function SkillSliders({ values, onChange }) {
  return (
    <div className="sliders">
      {SKILLS.map((skill, i) => (
        <div className="slider" key={skill.key}>
          <span className="slider-label">{skill.label}</span>
          <input
            type="range" min="0" max="10" step="1"
            value={values[i]}
            aria-label={skill.label}
            onChange={(e) => onChange(i, Number(e.target.value))}
          />
          <b className="slider-value">{values[i]}</b>
        </div>
      ))}
    </div>
  );
}

function Gauge({ value }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const { tone } = getTier(value);
  return (
    <div className={`gauge ${tone}`}>
      <svg viewBox="0 0 120 120">
        <circle className="gauge-track" cx="60" cy="60" r={r} />
        <circle className="gauge-bar" cx="60" cy="60" r={r}
          strokeDasharray={c} strokeDashoffset={c * (1 - value)} />
      </svg>
      <div className="gauge-text">
        <strong>{(value * 100).toFixed(1)}%</strong>
        <span>match</span>
      </div>
    </div>
  );
}

export default function App() {
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState('idle'); // idle | loading | done | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setSkill = (key) => (index, value) =>
    setForm((f) => ({ ...f, [key]: f[key].map((v, i) => (i === index ? value : v)) }));

  const requiredKeys = ['age', 'gender', 'DegreeProgram', 'cgpa',
    'certificationsCount', 'internshipExperience', 'jobTitle',
    'minExperienceMonths', 'location'];

  const completion = useMemo(() => {
    const filled = requiredKeys.filter((k) => form[k] !== '').length
      + (form.skills.some((v) => v > 0) ? 1 : 0)
      + (form.requiredSkills.some((v) => v > 0) ? 1 : 0);
    return Math.round((filled / (requiredKeys.length + 2)) * 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  // Skill-by-skill comparison (student level vs job requirement)
  const coverage = useMemo(() => SKILLS.map((s, i) => {
    const have = form.skills[i];
    const need = form.requiredSkills[i];
    return { label: s.label, have, need, met: have >= need, gap: Math.max(need - have, 0) };
  }), [form.skills, form.requiredSkills]);

  const metCount = coverage.filter((c) => c.met).length;
  const hasExperienceInput = form.internshipExperience !== '' && form.minExperienceMonths !== '';
  const experienceMet = hasExperienceInput
    && Number(form.internshipExperience) >= Number(form.minExperienceMonths);

  const canSubmit = requiredKeys.every((k) => String(form[k]).trim() !== '');

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit || status === 'loading') return;
    setStatus('loading');
    setError('');

    // skills / requiredSkills are 0-10 levels in the same order as SKILLS
    const payload = {
      ...form,
      age: Number(form.age),
      cgpa: Number(form.cgpa),
      certificationsCount: Number(form.certificationsCount),
      internshipExperience: Number(form.internshipExperience),
      minExperienceMonths: Number(form.minExperienceMonths),
      skills: form.skills.map(Number),
      requiredSkills: form.requiredSkills.map(Number),
    };

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Server responded with ${res.status}`);
      const data = await res.json();

      // Adjust these keys to whatever your API returns
      let prob = data.matchProbability ?? data.probability ?? data.match_probability;
      if (typeof prob === 'number' && prob > 1) prob /= 100;
      const label = data.prediction ?? data.match ?? data.label;
      setResult({ prob: typeof prob === 'number' ? prob : null, label, raw: data });
      setStatus('done');
    } catch (err) {
      setError(err.message || 'Could not reach the prediction service.');
      setStatus('error');
    }
  };

  const reset = () => {
    setForm(initialForm);
    setResult(null);
    setStatus('idle');
  };

  const tier = result && result.prob !== null ? getTier(result.prob) : null;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark"><Layers size={18} /></span>
          <div>
            <strong>Path AI</strong>
            <small>Intelligence platform</small>
          </div>
        </div>
        <nav>
          <p className="nav-title">Modules</p>
          {modules.map(({ id, label, icon: Icon, status: s }) => (
            <button key={id} type="button" disabled={s !== 'active'}
              className={`nav-item ${s === 'active' ? 'active' : ''}`}>
              <Icon size={16} />
              <span>{label}</span>
              {s === 'soon' && <Lock size={12} className="nav-lock" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">Phase 1 &middot; Classification</div>
      </aside>

      <main className="main">
        <header className="page-head">
          <div>
            <p className="eyebrow">Module 01</p>
            <h1>Job Match</h1>
            <p className="lede">
              Compare a software student profile against a job posting and estimate how likely the candidate is to be a fit.
            </p>
          </div>
          <div className="progress" aria-label="Form completion">
            <div className="progress-top"><span>Profile completeness</span><b>{completion}%</b></div>
            <div className="progress-bar"><i style={{ width: `${completion}%` }} /></div>
          </div>
        </header>

        <div className="layout">
          <form className="forms" onSubmit={handleSubmit}>
            <section className="card">
              <div className="card-head">
                <span className="card-icon"><UserRound size={16} /></span>
                <div><h2>Student profile</h2><p>Background, record and skill levels</p></div>
              </div>
              <div className="grid">
                <Field label="Age" hint="18 - 29">
                  <input type="number" min="18" max="29" value={form.age} onChange={set('age')} placeholder="22" />
                </Field>
                <Field label="Gender">
                  <select value={form.gender} onChange={set('gender')}>
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </Field>
                <Field label="Program" icon={GraduationCap}>
                  <select value={form.DegreeProgram} onChange={set('DegreeProgram')}>
                    <option value="">Select</option>
                    {PROGRAMS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </Field>
                <Field label="CGPA" hint="Score, 0 - 4">
                  <input type="number" min="0" max="4" step="0.01" value={form.cgpa} onChange={set('cgpa')} placeholder="3.50" />
                </Field>
                <Field label="Certifications" icon={Award}>
                  <input type="number" min="0" step="1" value={form.certificationsCount} onChange={set('certificationsCount')} placeholder="2" />
                </Field>
                <Field label="Internship experience" icon={Clock} hint="In months">
                  <input type="number" min="0" step="1" value={form.internshipExperience} onChange={set('internshipExperience')} placeholder="6" />
                </Field>
              </div>

              <div className="field">
                <span className="field-label">Skill levels</span>
                <SkillSliders values={form.skills} onChange={setSkill('skills')} />
                <span className="field-hint">0 = none, 5 = works with supervision, 10 = expert</span>
              </div>
            </section>

            <section className="card">
              <div className="card-head">
                <span className="card-icon"><Briefcase size={16} /></span>
                <div><h2>Job posting</h2><p>Role and the level it requires</p></div>
              </div>
              <div className="grid">
                <Field label="Job title">
                  <select value={form.jobTitle} onChange={set('jobTitle')}>
                    <option value="">Select</option>
                    {JOB_TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Location" icon={MapPin}>
                  <select value={form.location} onChange={set('location')}>
                    <option value="">Select</option>
                    {LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </Field>
                <Field label="Minimum experience" hint="In months, 0 - 12">
                  <input type="number" min="0" max="12" step="1" value={form.minExperienceMonths} onChange={set('minExperienceMonths')} placeholder="6" />
                </Field>
              </div>

              <div className="field">
                <span className="field-label">Required skill levels</span>
                <SkillSliders values={form.requiredSkills} onChange={setSkill('requiredSkills')} />
                <span className="field-hint">The minimum level the job needs in each skill</span>
              </div>
            </section>

            <div className="actions">
              <button type="button" className="btn ghost" onClick={reset}>
                <RotateCcw size={15} /> Reset
              </button>
              <button type="submit" className="btn primary" disabled={!canSubmit || status === 'loading'}>
                {status === 'loading'
                  ? <><Loader2 size={15} className="spin" /> Analysing</>
                  : <>Check job match <ArrowRight size={15} /></>}
              </button>
            </div>
          </form>

          <aside className="result card">
            <div className="card-head">
              <span className="card-icon"><Target size={16} /></span>
              <div><h2>Match result</h2><p>Model output</p></div>
            </div>

            {status === 'idle' && (
              <div className="empty">
                <Target size={28} />
                <p>Fill in the student and job details, then run the check. Results appear here.</p>
                {!canSubmit && <small>All profile and job fields are needed (skill levels default to 0).</small>}
              </div>
            )}

            {status === 'loading' && (
              <div className="empty"><Loader2 size={28} className="spin" /><p>Running the model...</p></div>
            )}

            {status === 'error' && (
              <div className="alert">
                <AlertCircle size={18} />
                <div><b>Request failed</b><p>{error}</p><small>Check that the API is running on port 5000.</small></div>
              </div>
            )}

            {status === 'done' && result && (
              <div className="outcome">
                {result.prob !== null && <Gauge value={result.prob} />}
                {tier && (
                  <div className={`verdict tier-${tier.tone}`}>
                    <CheckCircle2 size={16} />
                    <span>{tier.name}</span>
                  </div>
                )}
                {!tier && result.label !== undefined && (
                  <div className="verdict">
                    <CheckCircle2 size={16} />
                    <span>{String(result.label)}</span>
                  </div>
                )}
                {result.prob === null && result.label === undefined && (
                  <pre className="raw">{JSON.stringify(result.raw, null, 2)}</pre>
                )}
              </div>
            )}

            <div className="overlap">
              <h3>Skill coverage <span className="overlap-count">{metCount} / {SKILLS.length} met</span></h3>
              <ul>
                {coverage.map(({ label, have, need, met, gap }) => (
                  <li key={label} className={met ? 'yes' : 'no'}>
                    {met ? <Check size={14} /> : <Minus size={14} />}
                    <span>{label}</span>
                    <em>{met ? `${have} / ${need}` : `${have} / ${need} (short by ${gap})`}</em>
                  </li>
                ))}
                {hasExperienceInput && (
                  <li className={experienceMet ? 'yes' : 'no'}>
                    {experienceMet ? <Check size={14} /> : <Minus size={14} />}
                    <span>Experience</span>
                    <em>{form.internshipExperience} / {form.minExperienceMonths} months</em>
                  </li>
                )}
              </ul>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}