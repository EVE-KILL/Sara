import { IContainer } from '../../types/Services.js';

/**
 * Simple dependency injection container for managing services
 */
export class Container implements IContainer {
    private services = new Map<string, any>();
    private singletons = new Set<string>();

    /**
     * Register a service instance
     */
    register<T>(name: string, instance: T): void {
        this.services.set(name, instance);
        console.log(`📦 Registered service: ${name}`);
    }

    /**
     * Register a singleton service (lazy instantiation)
     */
    registerSingleton<T>(name: string, factory: () => T): void {
        this.services.set(name, factory);
        this.singletons.add(name);
        console.log(`📦 Registered singleton: ${name}`);
    }

    /**
     * Get a service instance
     */
    get<T>(name: string): T {
        const service = this.services.get(name);
        if (!service) {
            throw new Error(`Service '${name}' not found in container`);
        }

        // Handle singleton pattern
        if (this.singletons.has(name) && typeof service === 'function') {
            const instance = service();
            this.services.set(name, instance);
            this.singletons.delete(name);
            return instance;
        }

        return service;
    }

    /**
     * Check if a service is registered
     */
    has(name: string): boolean {
        return this.services.has(name);
    }

    /**
     * Get all registered service names
     */
    getServiceNames(): string[] {
        return Array.from(this.services.keys());
    }

    /**
     * Clear all services (useful for testing)
     */
    clear(): void {
        this.services.clear();
        this.singletons.clear();
    }

    /**
     * Initialize all services that have an initialize method
     */
    async initializeAll(): Promise<void> {
        console.log('🚀 Initializing all services...');

        for (const [name, service] of this.services) {
            if (service && typeof service.initialize === 'function') {
                try {
                    await service.initialize();
                    console.log(`✅ Initialized service: ${name}`);
                } catch (error) {
                    console.error(`❌ Failed to initialize service ${name}:`, error);
                }
            }
        }
    }

    /**
     * Cleanup all services that have a cleanup method
     */
    async cleanupAll(): Promise<void> {
        console.log('🧹 Cleaning up all services...');

        for (const [name, service] of this.services) {
            if (service && typeof service.cleanup === 'function') {
                try {
                    await service.cleanup();
                    console.log(`✅ Cleaned up service: ${name}`);
                } catch (error) {
                    console.error(`❌ Failed to cleanup service ${name}:`, error);
                }
            }
        }
    }
}
