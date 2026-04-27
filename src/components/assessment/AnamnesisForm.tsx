"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { Save, Stethoscope } from "lucide-react";
import type { PatientDetail } from "@/types/domain.types";

interface AnamnesisFormProps {
  patient?: PatientDetail;
  patientId: string;
}

interface FormData {
  chiefComplaint: string;
  mainSymptoms: string;
  initialSymptoms: string;
  diagnosisRelated: string;
  diagnosisDetails: string;
  symptomsStart: string;
  symptomsDuration: string;
  symptomsFrequency: string;
  symptomsIntensity: string;
  symptomsProgression: string;
  secondarySymptoms: string[];
  secondaryDetails: string;
  hasOperations: string;
  operationsDetails: string;
  treatments: string;
  medications: string;
  brainMRI: string;
  mriDetails: string;
  otherScans: string;
  neuromodulation: string;
  neuromodulationDetails: string;
}

export function AnamnesisForm({ patient, patientId }: AnamnesisFormProps) {
  const [formData, setFormData] = useState<FormData>({
    chiefComplaint: "",
    mainSymptoms: "",
    initialSymptoms: "",
    diagnosisRelated: "",
    diagnosisDetails: "",
    symptomsStart: "",
    symptomsDuration: "",
    symptomsFrequency: "",
    symptomsIntensity: "",
    symptomsProgression: "",
    secondarySymptoms: [],
    secondaryDetails: "",
    hasOperations: "",
    operationsDetails: "",
    treatments: "",
    medications: "",
    brainMRI: "",
    mriDetails: "",
    otherScans: "",
    neuromodulation: "",
    neuromodulationDetails: "",
  });

  const [isSaving, setIsSaving] = useState(false);

  const handleTextChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleRadioChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCheckboxChange = (value: string, checked: boolean) => {
    setFormData(prev => {
      const updated = checked
        ? [...prev.secondarySymptoms, value]
        : prev.secondarySymptoms.filter(s => s !== value);
      return { ...prev, secondarySymptoms: updated };
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save to localStorage for now (can be replaced with API call)
      const dataToSave = {
        ...formData,
        patientId,
        completedAt: new Date().toISOString(),
        completedBy: "Dr. Current User",
      };
      localStorage.setItem(`anamnesis-${patientId}`, JSON.stringify(dataToSave));
      alert("Anamnesis form saved successfully!");
    } catch (error) {
      console.error("Error saving form:", error);
      alert("Error saving form. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg px-6 py-6 border border-orange-200">
        <div className="flex items-start gap-4">
          <div className="bg-orange-500 rounded-lg p-3">
            <Stethoscope className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-2 mb-1">
              Start New Anamnesis Assessment
            </h1>
            <p className="text-sm text-neutral-600">Patient Symptoms & Medical History (New Entry)</p>
          </div>
        </div>
      </div>

      {/* Patient Info Card */}
      {patient && (
        <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-6">
          <h2 className="text-lg font-bold text-neutral-900 mb-2">Patient Information</h2>
          <p className="text-sm text-neutral-600 mb-4">{patient.full_name} - Clinical Assessment Active</p>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <p className="text-xs font-semibold text-neutral-600 uppercase mb-1 tracking-wide">Patient ID</p>
              <p className="text-sm font-bold text-neutral-900">{patient.mrn || patientId}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-neutral-600 uppercase mb-1 tracking-wide">Assessment Date</p>
              <p className="text-sm font-bold text-neutral-900">{new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-neutral-600 uppercase mb-1 tracking-wide">Age</p>
              <p className="text-sm font-bold text-neutral-900">
                {patient.date_of_birth ? new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear() : "—"} years
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Section 1: Chief Complaint */}
      <div className="bg-white rounded-lg border border-neutral-200 p-6 space-y-4">
        <h3 className="text-lg font-bold text-neutral-900 pb-3 border-b-2 border-orange-500 flex items-center gap-2">
          <span className="text-orange-500">1.</span> Chief Complaint & Diagnosis
        </h3>
        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-2">Why are you here today? / Primary Diagnosis</label>
          <textarea
            value={formData.chiefComplaint}
            onChange={(e) => handleTextChange("chiefComplaint", e.target.value)}
            placeholder="Describe the main reason for this visit and any existing diagnosis..."
            className="w-full px-4 py-3 border-2 border-neutral-200 rounded-lg focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 text-sm min-h-24"
          />
        </div>
      </div>

      {/* Section 2: Main Symptoms */}
      <div className="bg-white rounded-lg border border-neutral-200 p-6 space-y-4">
        <h3 className="text-lg font-bold text-neutral-900 pb-3 border-b-2 border-orange-500 flex items-center gap-2">
          <span className="text-orange-500">2.</span> Main Symptoms
        </h3>

        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-2">What are your main symptoms?</label>
          <textarea
            value={formData.mainSymptoms}
            onChange={(e) => handleTextChange("mainSymptoms", e.target.value)}
            placeholder="Describe the primary symptoms you are experiencing..."
            className="w-full px-4 py-3 border-2 border-neutral-200 rounded-lg focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 text-sm min-h-24"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-2">What were the initial symptoms?</label>
          <textarea
            value={formData.initialSymptoms}
            onChange={(e) => handleTextChange("initialSymptoms", e.target.value)}
            placeholder="Describe how your symptoms first appeared..."
            className="w-full px-4 py-3 border-2 border-neutral-200 rounded-lg focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 text-sm min-h-24"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-2">Is there a diagnosis related to the symptoms?</label>
          <div className="flex gap-8 mb-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="diagnosisRelated"
                value="yes"
                checked={formData.diagnosisRelated === "yes"}
                onChange={(e) => handleRadioChange("diagnosisRelated", e.target.value)}
                className="w-4 h-4 accent-orange-500"
              />
              <span className="text-sm text-neutral-700">Yes</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="diagnosisRelated"
                value="no"
                checked={formData.diagnosisRelated === "no"}
                onChange={(e) => handleRadioChange("diagnosisRelated", e.target.value)}
                className="w-4 h-4 accent-orange-500"
              />
              <span className="text-sm text-neutral-700">No</span>
            </label>
          </div>
          <input
            type="text"
            value={formData.diagnosisDetails}
            onChange={(e) => handleTextChange("diagnosisDetails", e.target.value)}
            placeholder="If yes, please specify the diagnosis..."
            className="w-full px-4 py-2 border-2 border-neutral-200 rounded-lg focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-2">When did the symptoms start?</label>
          <input
            type="text"
            value={formData.symptomsStart}
            onChange={(e) => handleTextChange("symptomsStart", e.target.value)}
            placeholder="e.g., 3 months ago, January 2024..."
            className="w-full px-4 py-2 border-2 border-neutral-200 rounded-lg focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-2">For how long have you had these symptoms?</label>
          <input
            type="text"
            value={formData.symptomsDuration}
            onChange={(e) => handleTextChange("symptomsDuration", e.target.value)}
            placeholder="e.g., 2 weeks, 6 months, 2 years..."
            className="w-full px-4 py-2 border-2 border-neutral-200 rounded-lg focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-2">How often do you have these symptoms?</label>
          <select
            value={formData.symptomsFrequency}
            onChange={(e) => handleTextChange("symptomsFrequency", e.target.value)}
            className="w-full px-4 py-2 border-2 border-neutral-200 rounded-lg focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 text-sm"
          >
            <option value="">Select frequency...</option>
            <option value="daily">Daily</option>
            <option value="several-times-week">Several times a week</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="occasionally">Occasionally</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-2">How intense or severe are these symptoms?</label>
          <select
            value={formData.symptomsIntensity}
            onChange={(e) => handleTextChange("symptomsIntensity", e.target.value)}
            className="w-full px-4 py-2 border-2 border-neutral-200 rounded-lg focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 text-sm"
          >
            <option value="">Select intensity...</option>
            <option value="mild">Mild</option>
            <option value="moderate">Moderate</option>
            <option value="severe">Severe</option>
            <option value="very-severe">Very Severe</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-2">Are the symptoms getting better, worse, or staying about the same?</label>
          <select
            value={formData.symptomsProgression}
            onChange={(e) => handleTextChange("symptomsProgression", e.target.value)}
            className="w-full px-4 py-2 border-2 border-neutral-200 rounded-lg focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 text-sm"
          >
            <option value="">Select progression...</option>
            <option value="better">Getting better</option>
            <option value="worse">Getting worse</option>
            <option value="same">Staying about the same</option>
            <option value="fluctuating">Fluctuating</option>
          </select>
        </div>
      </div>

      {/* Section 3: Secondary Symptoms */}
      <div className="bg-white rounded-lg border border-neutral-200 p-6 space-y-4">
        <h3 className="text-lg font-bold text-neutral-900 pb-3 border-b-2 border-orange-500 flex items-center gap-2">
          <span className="text-orange-500">3.</span> Secondary Symptoms
        </h3>
        <p className="text-sm text-neutral-600">Please check all that apply and provide details where relevant:</p>

        <div className="grid grid-cols-2 gap-4">
          {[
            { value: "sleep", label: "Sleep Issues" },
            { value: "concentration", label: "Concentration Problems" },
            { value: "memory", label: "Memory Issues" },
            { value: "gastrointestinal", label: "Gastrointestinal Issues" },
            { value: "mood", label: "Mood Fluctuations" },
            { value: "fatigue", label: "Fatigue" },
            { value: "weakness", label: "Weakness" },
            { value: "pain", label: "Pain" },
            { value: "depression", label: "Depression/Anxiety" },
            { value: "bladder", label: "Bladder Function Issues" },
          ].map(({ value, label }) => (
            <label key={value} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-neutral-50">
              <input
                type="checkbox"
                checked={formData.secondarySymptoms.includes(value)}
                onChange={(e) => handleCheckboxChange(value, e.target.checked)}
                className="w-4 h-4 accent-orange-500"
              />
              <span className="text-sm text-neutral-700">{label}</span>
            </label>
          ))}
        </div>

        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-2">Additional details about secondary symptoms:</label>
          <textarea
            value={formData.secondaryDetails}
            onChange={(e) => handleTextChange("secondaryDetails", e.target.value)}
            placeholder="Please provide more details about the checked symptoms..."
            className="w-full px-4 py-3 border-2 border-neutral-200 rounded-lg focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 text-sm min-h-24"
          />
        </div>
      </div>

      {/* Section 4: Operations/Surgeries */}
      <div className="bg-white rounded-lg border border-neutral-200 p-6 space-y-4">
        <h3 className="text-lg font-bold text-neutral-900 pb-3 border-b-2 border-orange-500 flex items-center gap-2">
          <span className="text-orange-500">4.</span> Operations/Surgeries
        </h3>

        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-2">Have you had any operations or surgeries?</label>
          <div className="flex gap-8">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="hasOperations"
                value="yes"
                checked={formData.hasOperations === "yes"}
                onChange={(e) => handleRadioChange("hasOperations", e.target.value)}
                className="w-4 h-4 accent-orange-500"
              />
              <span className="text-sm text-neutral-700">Yes</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="hasOperations"
                value="no"
                checked={formData.hasOperations === "no"}
                onChange={(e) => handleRadioChange("hasOperations", e.target.value)}
                className="w-4 h-4 accent-orange-500"
              />
              <span className="text-sm text-neutral-700">No</span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-2">If yes, please provide details:</label>
          <textarea
            value={formData.operationsDetails}
            onChange={(e) => handleTextChange("operationsDetails", e.target.value)}
            placeholder="Include: Which operations, how many, when performed, post-surgery condition/effects..."
            className="w-full px-4 py-3 border-2 border-neutral-200 rounded-lg focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 text-sm min-h-24"
          />
        </div>
      </div>

      {/* Section 5: Previous/Ongoing Treatments */}
      <div className="bg-white rounded-lg border border-neutral-200 p-6 space-y-4">
        <h3 className="text-lg font-bold text-neutral-900 pb-3 border-b-2 border-orange-500 flex items-center gap-2">
          <span className="text-orange-500">5.</span> Previous or Ongoing Treatments
        </h3>
        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-2">Previous or ongoing treatments (physiotherapy, speech therapy, psychotherapy, etc.)</label>
          <textarea
            value={formData.treatments}
            onChange={(e) => handleTextChange("treatments", e.target.value)}
            placeholder="Include: Type of treatment, how long, how often, outcomes/improvements..."
            className="w-full px-4 py-3 border-2 border-neutral-200 rounded-lg focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 text-sm min-h-24"
          />
        </div>
      </div>

      {/* Section 6: Medications */}
      <div className="bg-white rounded-lg border border-neutral-200 p-6 space-y-4">
        <h3 className="text-lg font-bold text-neutral-900 pb-3 border-b-2 border-orange-500 flex items-center gap-2">
          <span className="text-orange-500">6.</span> Medications & Supplements
        </h3>
        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-2">Current medications and supplements:</label>
          <textarea
            value={formData.medications}
            onChange={(e) => handleTextChange("medications", e.target.value)}
            placeholder="List all current medications and supplements with dosages..."
            className="w-full px-4 py-3 border-2 border-neutral-200 rounded-lg focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 text-sm min-h-24"
          />
        </div>
      </div>

      {/* Section 7: Brain MRI & Scans */}
      <div className="bg-white rounded-lg border border-neutral-200 p-6 space-y-4">
        <h3 className="text-lg font-bold text-neutral-900 pb-3 border-b-2 border-orange-500 flex items-center gap-2">
          <span className="text-orange-500">7.</span> Brain MRI & Other Scans
        </h3>

        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-2">Have you had a Brain MRI?</label>
          <div className="flex gap-8">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="brainMRI"
                value="yes"
                checked={formData.brainMRI === "yes"}
                onChange={(e) => handleRadioChange("brainMRI", e.target.value)}
                className="w-4 h-4 accent-orange-500"
              />
              <span className="text-sm text-neutral-700">Yes</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="brainMRI"
                value="no"
                checked={formData.brainMRI === "no"}
                onChange={(e) => handleRadioChange("brainMRI", e.target.value)}
                className="w-4 h-4 accent-orange-500"
              />
              <span className="text-sm text-neutral-700">No</span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-2">If yes, when was it performed and what were the results?</label>
          <textarea
            value={formData.mriDetails}
            onChange={(e) => handleTextChange("mriDetails", e.target.value)}
            placeholder="Include: Date of MRI, results, any other scans (CT, EEG, EMG)..."
            className="w-full px-4 py-3 border-2 border-neutral-200 rounded-lg focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 text-sm min-h-24"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-2">Other scans (CT, EEG, EMG, etc.):</label>
          <textarea
            value={formData.otherScans}
            onChange={(e) => handleTextChange("otherScans", e.target.value)}
            placeholder="List any other scans or tests performed..."
            className="w-full px-4 py-3 border-2 border-neutral-200 rounded-lg focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 text-sm min-h-24"
          />
        </div>
      </div>

      {/* Section 8: Neuromodulation Experience */}
      <div className="bg-white rounded-lg border border-neutral-200 p-6 space-y-4">
        <h3 className="text-lg font-bold text-neutral-900 pb-3 border-b-2 border-orange-500 flex items-center gap-2">
          <span className="text-orange-500">8.</span> Neuromodulation Experience
        </h3>

        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-2">Have you used any neuromodulation techniques before?</label>
          <div className="flex gap-8">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="neuromodulation"
                value="yes"
                checked={formData.neuromodulation === "yes"}
                onChange={(e) => handleRadioChange("neuromodulation", e.target.value)}
                className="w-4 h-4 accent-orange-500"
              />
              <span className="text-sm text-neutral-700">Yes</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="neuromodulation"
                value="no"
                checked={formData.neuromodulation === "no"}
                onChange={(e) => handleRadioChange("neuromodulation", e.target.value)}
                className="w-4 h-4 accent-orange-500"
              />
              <span className="text-sm text-neutral-700">No</span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-2">If yes, please specify devices used and experience:</label>
          <textarea
            value={formData.neuromodulationDetails}
            onChange={(e) => handleTextChange("neuromodulationDetails", e.target.value)}
            placeholder="Include: Type of device, duration of use, effectiveness, any side effects..."
            className="w-full px-4 py-3 border-2 border-neutral-200 rounded-lg focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 text-sm min-h-24"
          />
        </div>
      </div>

      {/* Save Button */}
      <Button
        size="lg"
        onClick={handleSave}
        isLoading={isSaving}
        className="w-full bg-orange-500 hover:bg-orange-600 text-white"
      >
        <Save className="w-5 h-5" />
        Save Anamnesis Form
      </Button>
    </div>
  );
}
