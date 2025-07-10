'use client';

import { useState } from 'react';

interface ChannelConfigurationProps {
  channelId: string;
  configuration: {
    endpoint?: string;
    provider?: string;
    version?: string;
  };
}

export default function ChannelConfiguration({ channelId, configuration }: ChannelConfigurationProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedConfig, setEditedConfig] = useState(configuration);

  const handleSave = () => {
    // In a real implementation, this would call an API to update the configuration
    console.log('Saving configuration for channel:', channelId, editedConfig);
    setIsEditing(false);
    // TODO: Call API to save configuration
  };

  const handleCancel = () => {
    setEditedConfig(configuration);
    setIsEditing(false);
  };

  const updateConfig = (key: string, value: string) => {
    setEditedConfig({
      ...editedConfig,
      [key]: value,
    });
  };

  return (
    <div className="space-y-6">
      {/* Configuration Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Channel Configuration</h3>
          <p className="text-sm text-gray-600">Manage channel settings and parameters</p>
        </div>
        <div className="flex space-x-2">
          {isEditing ? (
            <>
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Save Changes
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              Edit Configuration
            </button>
          )}
        </div>
      </div>

      {/* Configuration Form */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="space-y-6">
          {/* Basic Configuration */}
          <div>
            <h4 className="text-md font-semibold text-gray-900 mb-4">Basic Settings</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Provider
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedConfig.provider || ''}
                    onChange={(e) => updateConfig('provider', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., twilio, sendgrid"
                  />
                ) : (
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm">
                    {configuration.provider || 'Not configured'}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Version
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedConfig.version || ''}
                    onChange={(e) => updateConfig('version', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., v1, v2.1"
                  />
                ) : (
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm">
                    {configuration.version || 'Not specified'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Endpoint Configuration */}
          <div>
            <h4 className="text-md font-semibold text-gray-900 mb-4">Endpoint Settings</h4>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Endpoint URL
              </label>
              {isEditing ? (
                <input
                  type="url"
                  value={editedConfig.endpoint || ''}
                  onChange={(e) => updateConfig('endpoint', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://api.example.com/webhook"
                />
              ) : (
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm break-all">
                  {configuration.endpoint || 'Not configured'}
                </div>
              )}
              <p className="text-xs text-gray-500 mt-1">
                The webhook endpoint URL for receiving messages
              </p>
            </div>
          </div>

          {/* Security Settings */}
          <div>
            <h4 className="text-md font-semibold text-gray-900 mb-4">Security Settings</h4>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    API Key
                  </label>
                  {isEditing ? (
                    <input
                      type="password"
                      placeholder="Enter API key"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  ) : (
                    <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm">
                      ••••••••••••••••
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Secret Token
                  </label>
                  {isEditing ? (
                    <input
                      type="password"
                      placeholder="Enter secret token"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  ) : (
                    <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm">
                      ••••••••••••••••
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Advanced Settings */}
          <div>
            <h4 className="text-md font-semibold text-gray-900 mb-4">Advanced Settings</h4>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Timeout (ms)
                  </label>
                  {isEditing ? (
                    <input
                      type="number"
                      defaultValue="30000"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  ) : (
                    <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm">
                      30000
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Retry Attempts
                  </label>
                  {isEditing ? (
                    <input
                      type="number"
                      defaultValue="3"
                      min="0"
                      max="10"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  ) : (
                    <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm">
                      3
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rate Limit (msg/min)
                  </label>
                  {isEditing ? (
                    <input
                      type="number"
                      defaultValue="60"
                      min="1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  ) : (
                    <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm">
                      60
                    </div>
                  )}
                </div>
              </div>

              {/* Feature Toggles */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Enable SSL Verification
                    </label>
                    <p className="text-xs text-gray-500">Verify SSL certificates for secure connections</p>
                  </div>
                  <input
                    type="checkbox"
                    defaultChecked
                    disabled={!isEditing}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Enable Message Queuing
                    </label>
                    <p className="text-xs text-gray-500">Queue messages when channel is unavailable</p>
                  </div>
                  <input
                    type="checkbox"
                    defaultChecked
                    disabled={!isEditing}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Enable Auto-Retry
                    </label>
                    <p className="text-xs text-gray-500">Automatically retry failed messages</p>
                  </div>
                  <input
                    type="checkbox"
                    defaultChecked
                    disabled={!isEditing}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Enable Monitoring
                    </label>
                    <p className="text-xs text-gray-500">Monitor channel health and performance</p>
                  </div>
                  <input
                    type="checkbox"
                    defaultChecked
                    disabled={!isEditing}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Configuration Actions */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <h4 className="text-md font-semibold text-yellow-900 mb-2">Important Notes</h4>
        <ul className="text-sm text-yellow-800 space-y-1">
          <li>• Changes to configuration may require channel restart</li>
          <li>• Test the channel after making configuration changes</li>
          <li>• Backup current configuration before making major changes</li>
          <li>• Some settings may take up to 5 minutes to take effect</li>
        </ul>
      </div>
    </div>
  );
}