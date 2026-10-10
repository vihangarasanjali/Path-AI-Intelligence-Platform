const ML_API_URL = process.env.ML_API_URL || 'http://localhost:8000';

// Order must match the `skills` / `requiredSkills` arrays sent by the React form
const SKILL_NAMES = [
    'Programming',
    'Database_SQL',
    'Version_Control_Git',
    'Problem_Solving',
    'Communication'
];

const MAX_CGPA = 4.0; // CGPA scale used by the form

// CGPA (0 - 4) -> percentage (0 - 100), rounded to 2 decimals.
// Linear conversion; change this one function if your university uses a different mapping.
const cgpaToPercentage = (cgpa) => {
    const value = Number(cgpa);
    if (!Number.isFinite(value) || value < 0 || value > MAX_CGPA) {
        throw badInput(`cgpa must be a number between 0 and ${MAX_CGPA}`);
    }
    return Math.round((value / MAX_CGPA) * 100 * 100) / 100;
};

const getHealthStatus = () => {
    return {
        status: 'OK',
        message: 'Job Matching API is healthy'
    };
};

const badInput = (message) => {
    const error = new Error(message);
    error.status = 422; // controller passes 422 through to the client
    return error;
};

// React payload (camelCase) -> FastAPI payload (model column names)
const toModelInput = (input = {}) => {
    const { skills, requiredSkills } = input;

    if (!Array.isArray(skills) || skills.length !== SKILL_NAMES.length) {
        throw badInput(`skills must be an array of ${SKILL_NAMES.length} numbers`);
    }
    if (!Array.isArray(requiredSkills) || requiredSkills.length !== SKILL_NAMES.length) {
        throw badInput(`requiredSkills must be an array of ${SKILL_NAMES.length} numbers`);
    }

    const modelInput = {
        Academic_Performance: cgpaToPercentage(input.cgpa),
        Certifications_Count: Number(input.certificationsCount),
        Internship_Experience: Number(input.internshipExperience),
        Min_Experience_Months: Number(input.minExperienceMonths),
        Job_Title: input.jobTitle,
        Degree_Program: input.DegreeProgram
    };

    SKILL_NAMES.forEach((name, i) => {
        modelInput[`Skill_${name}`] = Number(skills[i]);
        modelInput[`Required_${name}`] = Number(requiredSkills[i]);
    });

    return modelInput;
};

const predict = async (input) => {
    const response = await fetch(`${ML_API_URL}/predict`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(toModelInput(input))
    });

    if (!response.ok) {
        const detail = await response.text();
        const error = new Error(`Failed to get prediction: ${response.status} ${detail}`);
        error.status = response.status;
        throw error;
    }

    const data = await response.json();

    // Shape the response for App.jsx (it expects a 0-1 matchProbability)
    return {
        result: data.result,
        prediction: data.prediction,
        matchPercentage: data.match_percentage,
        matchProbability: data.match_percentage / 100
    };
};

module.exports = {
    getHealthStatus,
    predict
};