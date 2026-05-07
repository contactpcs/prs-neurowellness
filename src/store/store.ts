import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import sessionReducer from "./slices/sessionSlice";
import questionnaireReducer from "./slices/questionnaireSlice";
import catalogReducer from "./slices/catalogSlice";
import staffReducer from "./slices/staffSlice";
import doctorsReducer from "./slices/doctorsSlice";
import permissionsReducer from "./slices/permissionsSlice";
import alertsReducer from "./slices/alertsSlice";
import patientsReducer from "./slices/patientsSlice";
import scoresReducer from "./slices/scoresSlice";
import anamnesisReducer from "./slices/anamnesisSlice";
import notificationsReducer from "./slices/notificationsSlice";
import doctorNotesReducer from "./slices/doctorNotesSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    session: sessionReducer,
    questionnaire: questionnaireReducer,
    catalog: catalogReducer,
    staff: staffReducer,
    doctors: doctorsReducer,
    permissions: permissionsReducer,
    alerts: alertsReducer,
    patients: patientsReducer,
    scores: scoresReducer,
    anamnesis: anamnesisReducer,
    notifications: notificationsReducer,
    doctorNotes: doctorNotesReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
