import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Box,
  Paper,
  Stack,
  Tabs,
  Tab,
  Typography,
  Button,
  Tooltip,
  Alert,
  Menu,
  MenuItem,
  ButtonGroup
} from '@mui/material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { JsonForms } from '@jsonforms/react';
import Ajv from 'ajv'; // ajv is also used by jsonforms
import addMetaSchema2020 from 'ajv/dist/refs/json-schema-2020-12/index.js';
import { buildUISchema } from './buildUISchema';
import { renderers } from './renderers';
import MarkdownRenderer from './MarkdownRenderer';
import TestRunDialog from './TestRunDialog.js';
import { SettingsKey } from '../../../types/settings.js';
import { defaultProfileFrom } from '../../../types/profile.js';
import { API } from '../../services/api.js';
import { useTranslation } from 'react-i18next';

const ajv = new Ajv({
  useDefaults: true,
  allErrors: true,
  strict: false
});
addMetaSchema2020.call(ajv, false);
ajv.addFormat('file-path', {
  type: 'string',
  validate: (v: string) => typeof v === 'string' && v.length > 0
});
ajv.addFormat('directory-path', {
  type: 'string',
  validate: (v: string) => typeof v === 'string' && v.length > 0
});
ajv.addFormat('path', {
  type: 'string',
  validate: (v: string) => typeof v === 'string' && v.length > 0
});

const validationAjv = new Ajv({
  allErrors: true,
  strict: false
});
addMetaSchema2020.call(validationAjv, false);
validationAjv.addFormat('file-path', {
  type: 'string',
  validate: (v: string) => typeof v === 'string' && v.length > 0
});
validationAjv.addFormat('directory-path', {
  type: 'string',
  validate: (v: string) => typeof v === 'string' && v.length > 0
});
validationAjv.addFormat('path', {
  type: 'string',
  validate: (v: string) => typeof v === 'string' && v.length > 0
});

function TabPanel({ children, value, index }) {
  return value === index ? <Box sx={{ p: 2, flexGrow: 1 }}>{children}</Box> : null;
}

export default function ParametersPage({
  instance,
  refreshInstancesList,
  showHiddenParams,
  logMessage,
  onEditComplete,
  onLaunchSuccess,
  startOnParamsTab,
  ensureInstance
}) {
  const { t } = useTranslation();

  const [permitOverride, setPermitOverride] = useState<boolean>(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  const [params, setParams] = useState<Record<string, unknown>>({});
  const [schema, setSchema] = useState<Record<string, unknown> | null>({});
  const [allProfiles, setAllProfiles] = useState<string[]>([]);
  const [defaultProfile, setDefaultProfile] = useState<string>('standard');
  const [tabSelected, setTabSelected] = React.useState(startOnParamsTab ? 2 : 0);
  const [readme, setReadme] = useState<string>('');
  const [license, setLicense] = useState<string>('');
  const [isValidWorkflow, setIsValidWorkflow] = useState<boolean>(true);
  const [resourceWarning, setResourceWarning] = useState<{
    minimumCpu?: number;
    minimumMem?: number;
    effectiveCpu: number;
    effectiveMem: number;
    cpuSource: string;
    memSource: string;
  } | null>(null);

  const paramsFilter = 'JSON';
  const paramsFileFilters = [{ name: paramsFilter, extensions: ['json'] }];

  const ensureInstanceRef = useRef(ensureInstance);
  ensureInstanceRef.current = ensureInstance;
  // JsonForms applies schema defaults and fires onChange without any user
  // action; only edits following a pointer/keyboard interaction count as
  // edits worth creating an instance for.
  const userInteractedRef = useRef(false);
  // Set once a user edit has landed. The initial parameter load is async and
  // must not overwrite values typed while it was in flight.
  const userEditedRef = useRef(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingParamsRef = useRef<Record<string, unknown> | null>(null);
  const materializedRef = useRef<any>(null);
  const persistRef = useRef<(data: Record<string, unknown>) => void>(() => {});
  // Saves run in order, so a blur or unmount flush cannot overtake an earlier
  // debounced save and leave stale parameters on disk.
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());

  const stripProfile = (data: Record<string, unknown>) => {
    const copy = { ...data };
    delete copy['profile'];
    return copy;
  };

  // Save edits without waiting for a launch. When the workflow is still a
  // draft the first save materialises it on disk.
  const persistParams = async (data: Record<string, unknown>) => {
    try {
      const stripped = stripProfile(data);
      let target = materializedRef.current ?? instance;
      if (!target || target.draft) {
        target = await ensureInstanceRef.current?.(stripped);
        if (!target) return;
        materializedRef.current = target;
      }
      await API.saveWorkflowInstanceParams(target, stripped);
      // Only clear the pending value if nothing newer has been typed while the
      // save was in flight.
      if (pendingParamsRef.current === data) pendingParamsRef.current = null;
    } catch (err: any) {
      // Keep the pending value so the next edit, blur or unmount retries.
      logMessage(`Failed to save parameters: ${err?.message ?? 'Unknown error'}`, 'error');
    }
  };
  persistRef.current = persistParams;

  const queuePersist = (data: Record<string, unknown>) => {
    saveChainRef.current = saveChainRef.current
      .catch(() => {})
      .then(() => persistRef.current(data));
  };
  const queuePersistRef = useRef(queuePersist);
  queuePersistRef.current = queuePersist;

  const flushPending = () => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    const pending = pendingParamsRef.current;
    if (pending) queuePersistRef.current(pending);
  };
  const flushPendingRef = useRef(flushPending);
  flushPendingRef.current = flushPending;

  const scheduleAutosave = (data: Record<string, unknown>) => {
    pendingParamsRef.current = data;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      autosaveTimerRef.current = null;
      flushPendingRef.current();
    }, 500);
  };

  // Flush a pending edit when the page closes so parameter changes made just
  // before navigating away are not lost.
  useEffect(() => {
    return () => {
      flushPendingRef.current();
    };
  }, []);

  const resolveInstance = async (params, activate = false) => {
    if (instance && !instance.draft && instance.id) return instance;
    try {
      return await ensureInstanceRef.current?.(stripProfile(params), activate);
    } catch (err: any) {
      logMessage(`Error preparing instance: ${err?.message ?? 'Unknown error'}`, 'error');
      return null;
    }
  };

  const onLaunch = async (instance, params, ignoreValidation = false) => {
    if (!isValidWorkflow) {
      logMessage(t('parameters.no-valid-workflow'), 'error');
      return;
    }
    if (!ignoreValidation && computedErrors !== null) {
      setTabSelected(2);
      return;
    }
    // Strip out profile from params before sending to backend
    const call_params = { ...params };
    const profile = params['profile'] || defaultProfile;
    delete call_params['profile'];
    // Materialise an unsaved draft before launching it and switch to the
    // instance (the launch path is not part of parameter entry)
    const target = await resolveInstance(params, true);
    if (!target) return;
    // Return PID on success
    let result;
    try {
      result = await API.runWorkflow(target, call_params, { profile: profile });
    } catch (err: any) {
      logMessage(`Error launching workflow: ${err?.message ?? 'Unknown error'}`, 'error');
      return;
    }
    if (!result.ok) {
      logMessage(`Error launching workflow: ${result.error.message || 'Unknown error'}`, 'error');
      return;
    }
    logMessage(`Launched workflow ${target.name}`);
    refreshInstancesList();
    if (onLaunchSuccess) onLaunchSuccess(target.id);
    if (onEditComplete) onEditComplete();
  };

  const onSaveParams = async () => {
    const filePathResult = await API.showSaveDialog({ filters: paramsFileFilters });
    if (!filePathResult.ok) return;
    const filePath = filePathResult.data;
    if (!filePath) return;
    await API.writeTextFile(filePath, JSON.stringify(params, null, 2));
    logMessage(`Parameters saved to ${filePath}`);
  };

  const onLoadParams = async () => {
    const pickResult = await API.pickFile(paramsFileFilters);
    if (!pickResult.ok) return;
    const filePath = pickResult.data;
    if (!filePath) return;
    const readResult = await API.readTextFile(filePath);
    if (!readResult.ok) return;
    try {
      const loaded = JSON.parse(readResult.data);
      if (typeof loaded !== 'object' || loaded === null || Array.isArray(loaded)) {
        logMessage('Invalid parameters file: must be a JSON object.', 'error');
        return;
      }
      userInteractedRef.current = true;
      userEditedRef.current = true;
      setParams(loaded);
      setTabSelected(2);
      scheduleAutosave(loaded);
      logMessage(`Parameters loaded from ${filePath}`);
    } catch {
      logMessage('Invalid parameters file: could not parse JSON.', 'error');
    }
  };

  const onTestLaunchWorkflow = async (testProfiles) => {
    const test_profiles_str = testProfiles.join(',');
    const target = await resolveInstance({}, true);
    if (!target) return;
    let result;
    try {
      result = await API.runWorkflow(target, {}, { profile: test_profiles_str });
    } catch (err: any) {
      logMessage(`Error launching test workflow: ${err?.message ?? 'Unknown error'}`, 'error');
      return;
    }
    if (!result.ok) {
      logMessage(`Error launching test workflow: ${result.error.message}`, 'error');
      return;
    }
    logMessage(`Launched test workflow ${target.name}`);
    refreshInstancesList();
    if (onLaunchSuccess) onLaunchSuccess(target.id);
    if (onEditComplete) onEditComplete();
  };

  useEffect(() => {
    const getOverrideSetting = async () => {
      const result = await API.settingsGet(SettingsKey.PermitParamOverride);
      if (result.ok) setPermitOverride(result.data);
    };
    const get_available_profiles = async () => {
      const profilesResult = await API.getAvailableProfiles(instance);
      if (!profilesResult.ok) return ['standard'];
      const profiles = profilesResult.data;
      setAllProfiles(profiles || []);
      setDefaultProfile(defaultProfileFrom(profiles || []));
      return profiles || ['standard'];
    };
    const get_schema = async (profiles: string[]) => {
      const schemaResult = await API.getWorkflowSchema(instance.workflow_version.path);
      if (!schemaResult.ok) return;
      let schema = schemaResult.data;
      // Add profile selection to the a separate schema category
      if (profiles.length > 0) {
        if (!schema['Launch settings']) {
          schema['Launch settings'] = {};
        }
        schema['Launch settings']['profile'] = {
          type: 'array',
          title: 'Execution Profile(s)',
          description: 'Select one or more execution profile to use',
          items: {
            type: 'string',
            enum: profiles
          },
          uniqueItems: true,
          default: profiles.includes(defaultProfile) ? [defaultProfile] : []
        };
      }
      setSchema(schema);
    };
    const get_params = async () => {
      const paramsResult = await API.getWorkflowInstanceParams(instance);
      // Never clobber an edit made while the request was in flight.
      if (!userEditedRef.current && paramsResult.ok && paramsResult.data) {
        setParams(paramsResult.data);
      }
    };
    const fetchReadme = async () => {
      const result = await API.getWorkflowReadme(instance);
      if (result.ok) {
        setReadme(result.data || '');
      }
    };
    const fetchLicense = async () => {
      const result = await API.getWorkflowLicense(instance);
      if (result.ok) {
        setLicense(result.data || '');
      }
    };
    const checkValidWorkflow = async () => {
      const result = await API.isValidWorkflowRepo(instance.workflow_version.path);
      if (result.ok) {
        setIsValidWorkflow(result.data);
      }
    };

    get_available_profiles().then((profiles) => {
      getOverrideSetting();
      get_schema(profiles);
      get_params();
      fetchReadme();
      fetchLicense();
      checkValidWorkflow();
    });

    API.getInstanceResourceCheck(instance).then((result) => {
      if (result.ok) setResourceWarning(result.data);
    });
  }, [instance, startOnParamsTab]);

  const isEmpty = (obj) => {
    return Object.keys(obj).length === 0;
  };

  // Build the UI schema with stepper options
  const uischema = buildUISchema(schema, { showHidden: showHiddenParams });
  (uischema as any).options = { variant: 'stepper', showNavButtons: true };

  const computedErrors = useMemo(() => {
    if (!schema || isEmpty(schema)) return null;
    try {
      const validator = validationAjv.compile(schema);
      validator(params);
      return validator.errors?.length > 0 ? validator.errors : null;
    } catch {
      return null;
    }
  }, [schema, params]);

  const handleTabChange = (event, newValue) => {
    setTabSelected(newValue);
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="h6">
          [{instance.name}] {instance.workflow_version.name}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {permitOverride ? (
            <>
              <ButtonGroup variant="contained">
                <Tooltip
                  title={!isValidWorkflow ? t('parameters.no-valid-workflow') : ''}
                  disableHoverListener={isValidWorkflow}
                >
                  <span>
                    <Button
                      type="button"
                      disabled={!isValidWorkflow}
                      onClick={() => {
                        if (computedErrors !== null) {
                          setTabSelected(2);
                          return;
                        }
                        onLaunch(instance, params);
                      }}
                    >
                      {t('parameters.launch-workflow')}
                    </Button>
                  </span>
                </Tooltip>
                <Button
                  type="button"
                  size="small"
                  disabled={!isValidWorkflow}
                  onClick={(e) => setMenuAnchor(e.currentTarget)}
                >
                  <ArrowDropDownIcon />
                </Button>
              </ButtonGroup>
              <Menu
                anchorEl={menuAnchor}
                open={Boolean(menuAnchor)}
                onClose={() => setMenuAnchor(null)}
              >
                <MenuItem
                  onClick={() => {
                    setMenuAnchor(null);
                    onLaunch(instance, params, true);
                  }}
                >
                  {t('parameters.launch-ignore-validation')}
                </MenuItem>
              </Menu>
            </>
          ) : (
            <Tooltip
              title={!isValidWorkflow ? t('parameters.no-valid-workflow') : ''}
              disableHoverListener={isValidWorkflow}
            >
              <span>
                <Button
                  variant="contained"
                  disabled={!isValidWorkflow}
                  onClick={() => {
                    if (computedErrors !== null) {
                      setTabSelected(2);
                      return;
                    }
                    onLaunch(instance, params);
                  }}
                >
                  {t('parameters.launch-workflow')}
                </Button>
              </span>
            </Tooltip>
          )}
          {allProfiles.includes('test') && (
            <TestRunDialog allProfiles={allProfiles} onLaunch={onTestLaunchWorkflow} />
          )}
        </Box>
      </Box>

      {resourceWarning && (
        <Alert severity="warning" sx={{ mt: 1, mb: 1 }}>
          This workflow recommends at least
          {resourceWarning.minimumCpu ? ` ${resourceWarning.minimumCpu} CPUs` : ''}
          {resourceWarning.minimumCpu && resourceWarning.minimumMem ? ' and' : ''}
          {resourceWarning.minimumMem ? ` ${resourceWarning.minimumMem} GB RAM` : ''}. Effective
          limits: {resourceWarning.effectiveCpu} CPUs ({resourceWarning.cpuSource}) ,{' '}
          {resourceWarning.effectiveMem} GB RAM ({resourceWarning.memSource}).
        </Alert>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Tabs value={tabSelected} onChange={handleTabChange} sx={{ flex: 1 }}>
          <Tab label={t('parameters.info.title')} id="parameters-info-tab" />
          <Tab
            label={t('parameters.license.title')}
            id="parameters-license-tab"
            disabled={isEmpty(license)}
          />
          <Tab label={t('parameters.params.title')} id="parameters-params-tab" />
        </Tabs>
        {tabSelected === 2 && (
          <Box sx={{ display: 'flex', gap: 1, pr: 2 }}>
            <Button variant="outlined" size="small" onClick={onLoadParams}>
              {t('parameters.load-params')}
            </Button>
            <Button variant="outlined" size="small" onClick={onSaveParams}>
              {t('parameters.save-params')}
            </Button>
          </Box>
        )}
      </Box>

      <TabPanel value={tabSelected} index={0}>
        <MarkdownRenderer content={readme} basePath={instance.workflow_version.path} />
      </TabPanel>

      <TabPanel value={tabSelected} index={1}>
        <MarkdownRenderer content={license} basePath={instance.workflow_version.path} />
      </TabPanel>

      <TabPanel value={tabSelected} index={2}>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Paper
            variant="outlined"
            sx={{ p: 2, mb: 2, '& .MuiCardContent-root > div > * + *': { mt: 1.5 } }}
          >
            {!isEmpty(schema) ? (
              <Box
                onPointerDownCapture={() => {
                  userInteractedRef.current = true;
                }}
                onKeyDownCapture={() => {
                  userInteractedRef.current = true;
                }}
                onFocusCapture={() => {
                  userInteractedRef.current = true;
                }}
                // Commit as soon as focus leaves the form (clicking Launch, the
                // sidebar, another field) instead of waiting for the debounce.
                onBlurCapture={() => {
                  flushPendingRef.current();
                }}
              >
                <JsonForms
                  schema={schema}
                  uischema={uischema}
                  data={params}
                  renderers={renderers}
                  onChange={({ data }) => {
                    setParams(data);
                    // Ignore programmatic changes (e.g. schema defaults) so a
                    // previewed workflow is not materialised without an edit.
                    if (!userInteractedRef.current) return;
                    userEditedRef.current = true;
                    scheduleAutosave(data);
                  }}
                  ajv={ajv}
                />
              </Box>
            ) : (
              <Typography>{t('parameters.params.no-parameters')}</Typography>
            )}
          </Paper>
        </Stack>
      </TabPanel>
    </Box>
  );
}
